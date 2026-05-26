"use client";

import React from "react";
import { createRecordingData } from "@/app/player/_lib/recordingStorage";
import useRecording from "@/app/player/_lib/useRecording";
import { getFetchUrl, getLibMediaUrl, getMediaUrl, isLibMediaPath } from "@/lib/environment";
import { useRecordingStore } from "@/stores/useRecordingStore";
import {
  getEpisodeRecordingUploadErrorMessage,
  postHoleRecording,
} from "@/api/episodeRecordings";
import {
  getMyVoiceRecordingList,
  MY_VOICE_SLOT_MAX,
} from "@/api/myVoiceRecordings";
import { useGlobalSnackBarStore } from "@/stores/useGlobalSnackBarStore";
import { pushEvent } from "@/lib/analytics";
import styles from "./RecordingHoleItem.module.scss";

interface HoleRecord {
  src?: string;
  rawSrc?: string;
  url?: string;
}

type PreviewSourceType = "guide" | "recording";

export interface RecordingHoleItemProps {
  episodeId: number;
  itemIndex: number;
  hole: {
    uuid: string;
    script?: string;
    start_ms?: number;
    duration_ms?: number;
    characterName?: string;
    character_name?: string;
    records?: HoleRecord[];
  };
  thumbnailSrc?: string | null;
  onRequestExclusivePreview: (ownerId: string, audio: HTMLAudioElement) => void;
  onClearExclusivePreview: (audio: HTMLAudioElement) => void;
  /** 개별 홀 녹음 POST 성공 후 호출 (서버 데이터 재조회 트리거) */
  onRecordingSaved?: () => void;
  onRecordingBusyChange?: (holeUuid: string, isBusy: boolean) => void;
  /** 시범: 서버 저장·적용 UI 없이 메모리 미리듣기만 */
  trialEphemeralPlayback?: boolean;
}

function formatScript(script: string) {
  return script.replace(/^\((.*?)\)/, "").trim();
}

/** `useRecording` 언마운트 시 훅이 만든 blob URL을 revoke 하므로, 스토어에는 반드시 별도 createObjectURL 을 쓴다. */
function revokeStoredRecordingBlobUrl(url: string | undefined | null) {
  if (typeof url !== "string" || !url.startsWith("blob:")) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

function toPositiveFiniteMs(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return n;
}

function getRecordingStartErrorMessage(err: Error): string {
  const { name, message } = err;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용한 뒤 다시 시도해 주세요.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "마이크를 찾을 수 없습니다. 기기 연결을 확인해 주세요.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "마이크가 다른 앱에서 사용 중일 수 있습니다. 종료한 뒤 다시 시도해 주세요.";
  }
  if (name === "SecurityError") {
    return "보안 정책으로 마이크를 사용할 수 없습니다. HTTPS 또는 localhost로 접속했는지 확인해 주세요.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "요청한 마이크 설정을 이 환경에서 만족할 수 없습니다. 다른 브라우저나 기기에서 시도해 주세요.";
  }
  if (name === "NotSupportedError") {
    return "이 브라우저에서는 마이크 녹음을 지원하지 않습니다. Chrome 등 최신 브라우저로 시도해 주세요.";
  }
  if (name === "AbortError") {
    return "마이크 요청이 중단되었습니다. 다시 녹음 시작을 눌러 주세요.";
  }
  if (name === "TypeError") {
    return "이 환경에서는 마이크 API를 사용할 수 없습니다. 최신 브라우저인지, iframe/내장 브라우저가 아닌지 확인해 주세요.";
  }
  if (message === "MediaRecorder error" || message.includes("MediaRecorder")) {
    return "이 브라우저에서 지원하는 녹음 형식이 없거나 녹음기 오류가 났습니다. Chrome 또는 Safari 최신 버전으로 시도해 주세요.";
  }
  return "녹음을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

export default function RecordingHoleItem({
  episodeId,
  itemIndex,
  hole,
  thumbnailSrc,
  onRequestExclusivePreview,
  onClearExclusivePreview,
  onRecordingSaved,
  onRecordingBusyChange,
  trialEphemeralPlayback = false,
}: RecordingHoleItemProps) {
  const hasHoleRecording = useRecordingStore((state) => state.hasHoleRecording(hole.uuid));
  const isApplyRecording = useRecordingStore((state) => state.isApplyRecording(hole.uuid));
  const getRecording = useRecordingStore((state) => state.getRecording);
  const saveRecording = useRecordingStore((state) => state.saveRecording);
  const setRecordings = useRecordingStore((state) => state.setRecordings);
  const setRecordingApply = useRecordingStore((state) => state.setRecordingApply);
  const setUseUserRecording = useRecordingStore((state) => state.setUseUserRecording);
  const serverHoleId = useRecordingStore((s) => s.serverHoleIdByHoleUuid[hole.uuid]);
  const showSnackBar = useGlobalSnackBarStore((s) => s.showSnackBar);

  const holeMaxDurationMs = toPositiveFiniteMs(hole.duration_ms, 60000);

  const onRecordingError = React.useCallback(
    (err: Error) => {
      showSnackBar(getRecordingStartErrorMessage(err));
    },
    [showSnackBar],
  );

  const [isPreviewPlaying, setIsPreviewPlaying] = React.useState(false);
  const [previewProgress, setPreviewProgress] = React.useState(0);
  const [thumbnailVisible, setThumbnailVisible] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const thumbnailImgRef = React.useRef<HTMLImageElement | null>(null);
  const isExpanded = true;
  const currentRecording = getRecording(hole.uuid);
  const guideSource =
    hole.records?.[0]?.url ||
    hole.records?.[0]?.rawSrc ||
    hole.records?.[0]?.src;
  const recordingPreviewSource = currentRecording?.blobUrl;
  const canPreviewGuide = Boolean(guideSource);
  const canPreviewRecording = Boolean(recordingPreviewSource);

  const { duration, isRecording, status, startRecording, stopRecording } =
    useRecording({
      maxDuration: holeMaxDurationMs,
      onError: onRecordingError,
      onRecordingComplete: async (blob, _hookBlobUrl) => {
        const recordingData = await createRecordingData(
          hole.uuid,
          blob,
          duration,
          true
        );

        if (!recordingData) {
          return;
        }

        const prevRec = useRecordingStore.getState().recordings.find((r) => r.holeUuid === hole.uuid);
        revokeStoredRecordingBlobUrl(prevRec?.blobUrl);

        const storeBlobUrl = URL.createObjectURL(blob);
        const payload = { ...recordingData, blobUrl: storeBlobUrl, isApply: false };
        if (trialEphemeralPlayback) {
          const prev = useRecordingStore.getState().recordings;
          setRecordings([
            ...prev.filter((r) => r.holeUuid !== hole.uuid),
            { ...payload, isApply: false },
          ]);
        } else {
          saveRecording(episodeId, payload, "edu");
        }
        setPreviewProgress(0);
      },
    });
  const recordButtonLabel =
    status === "requesting"
      ? "준비 중…"
      : isRecording
        ? "녹음 종료"
        : hasHoleRecording
          ? "다시 녹음"
          : "녹음 시작";
  const isRecordingBusy = isRecording || status === "requesting";
  const hasRecordingPanelContent = hasHoleRecording || isRecording;

  React.useEffect(() => {
    onRecordingBusyChange?.(hole.uuid, isRecordingBusy);
    return () => {
      onRecordingBusyChange?.(hole.uuid, false);
    };
  }, [hole.uuid, isRecordingBusy, onRecordingBusyChange]);

  const stopPreviewAudio = React.useCallback(
    (options?: { resetProgress?: boolean }) => {
      const audio = audioRef.current;
      if (!audio) {
        setIsPreviewPlaying(false);
        if (options?.resetProgress ?? false) {
          setPreviewProgress(0);
        }
        return;
      }

      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onpause = null;
      audio.pause();
      onClearExclusivePreview(audio);
      audioRef.current = null;
      setIsPreviewPlaying(false);
      if (options?.resetProgress ?? true) {
        setPreviewProgress(0);
      }
    },
    [onClearExclusivePreview],
  );

  React.useEffect(() => {
    return () => {
      stopPreviewAudio({ resetProgress: true });
    };
  }, [stopPreviewAudio]);

  const thumbnailSrcResolved = thumbnailSrc || "/images/sample/record_sample.png";

  React.useLayoutEffect(() => {
    setThumbnailVisible(false);
    const el = thumbnailImgRef.current;
    if (el?.complete && el.naturalHeight > 0) {
      setThumbnailVisible(true);
    }
  }, [thumbnailSrcResolved]);

  const handleThumbnailLoad = React.useCallback(() => {
    setThumbnailVisible(true);
  }, []);

  const handleThumbnailError = React.useCallback(() => {
    setThumbnailVisible(true);
  }, []);

  const resolvePreviewUrl = (sourceType: PreviewSourceType) => {
    if (sourceType === "recording") {
      return recordingPreviewSource ?? null;
    }

    if (!guideSource) {
      return null;
    }

    return isLibMediaPath(guideSource)
      ? getFetchUrl(getLibMediaUrl(guideSource))
      : getFetchUrl(getMediaUrl(guideSource, "records"));
  };

  const handlePreview = async (sourceType: PreviewSourceType) => {
    try {
      stopPreviewAudio({ resetProgress: true });

      const resolvedUrl = resolvePreviewUrl(sourceType);
      if (!resolvedUrl) {
        return;
      }

      const audio = new Audio(resolvedUrl);
      audioRef.current = audio;
      onRequestExclusivePreview(hole.uuid, audio);
      setIsPreviewPlaying(true);
      setPreviewProgress(0);
      audio.currentTime = 0;
      audio.ontimeupdate = () => {
        if (audio.duration > 0) {
          setPreviewProgress(audio.currentTime / audio.duration);
        }
      };
      audio.onended = () => {
        onClearExclusivePreview(audio);
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        setIsPreviewPlaying(false);
        setPreviewProgress(0);
      };
      audio.onpause = () => {
        onClearExclusivePreview(audio);
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        setIsPreviewPlaying(false);
      };
      await audio.play();
    } catch {
      setIsPreviewPlaying(false);
      setPreviewProgress(0);
    }
  };

  const handleRecordAction = async () => {
    stopPreviewAudio({ resetProgress: true });

    if (isRecording) {
      stopRecording();
      return;
    }

    pushEvent("record", {
      episode_id: Number.isFinite(episodeId) && episodeId > 0 ? episodeId : undefined,
      hole_id: hole.uuid,
    });
    await startRecording(holeMaxDurationMs);
  };

  const [isSaving, setIsSaving] = React.useState(false);

  const handleApplyRecording = async () => {
    if (!hasHoleRecording || isSaving) return;

    if (trialEphemeralPlayback) {
      const prev = useRecordingStore.getState().recordings;
      setRecordings(
        prev.map((r) => (r.holeUuid === hole.uuid ? { ...r, isApply: true } : r)),
      );
      setUseUserRecording(true);
      onRecordingSaved?.();
      return;
    }

    try {
      const { items, slotMax } = await getMyVoiceRecordingList();
      const effectiveSlotMax =
        typeof slotMax === "number" && Number.isFinite(slotMax) && slotMax > 0
          ? slotMax
          : MY_VOICE_SLOT_MAX;
      const hasCurrentEpisodeEntry = items.some((item) => item.episodeId === episodeId);
      if (!hasCurrentEpisodeEntry && items.length >= effectiveSlotMax) {
        showSnackBar("마이 보이스 내역이 가득 찼습니다. 마이 보이스 내역에서 삭제 후 적용할 수 있습니다.");
        return;
      }
    } catch {
      showSnackBar("마이 보이스 내역 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    const recording = getRecording(hole.uuid);
    if (!recording?.blobData) {
      setRecordingApply(episodeId, hole.uuid, true, "edu");
      setUseUserRecording(true);
      onRecordingSaved?.();
      return;
    }

    if (!Number.isFinite(serverHoleId) || serverHoleId <= 0) {
      showSnackBar("홀 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setIsSaving(true);
    try {
      await postHoleRecording({
        holeUuid: hole.uuid,
        serverHoleId,
        src: recording.blobData,
        size: recording.blobData.length,
      });
      setRecordingApply(episodeId, hole.uuid, true, "edu");
      setUseUserRecording(true);
      onRecordingSaved?.();
    } catch (e) {
      console.error(
        "[RecordingHoleItem] 녹음 저장(프리사인·S3·/files/uploadUrls·POST /recordings) 실패:",
        e,
      );
      showSnackBar(getEpisodeRecordingUploadErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

  const showSampleImage = isExpanded;
  const showRecordingPanel = isExpanded && hasRecordingPanelContent;
  const maxRecordingDuration = Math.max(
    holeMaxDurationMs,
    toPositiveFiniteMs(currentRecording?.durationMs, 0),
    1000,
  );
  const barProgress = isRecording
    ? Math.max(0.06, Math.min(0.98, duration / maxRecordingDuration))
    : previewProgress;
  const canInteractWhileRecording = !isRecordingBusy && !isSaving;
  const canApplyRecording =
    hasHoleRecording && !isApplyRecording && canInteractWhileRecording;
  const articleClassName = [
    styles.holeItem,
    styles.expanded,
    showRecordingPanel ? styles.recordingPanelActive : "",
  ]
    .filter(Boolean)
    .join(" ");
  const recordingAreaClassName = [
    styles.recordingArea,
    styles.recordingAreaExpanded,
    showRecordingPanel ? styles.recordingAreaRecordingPanel : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={articleClassName}>
      <div className={styles.holeItemHeaderWrapper}>
        <div className={styles.headerToggleButton}>
          <span className={styles.toggleHeaderRow}>
            <span className={styles.headerTitleGroup}>
              <span className={styles.scriptIndex}>
                대사 {String(itemIndex + 1).padStart(2, "0")}
              </span>
            </span>
            {isApplyRecording ? (
              <span className={styles.applyStatusBadge}>적용중</span>
            ) : null}
          </span>
          <span className={styles.toggleBody}>
            <span className={styles.characterLabel}>
              {hole.characterName || hole.character_name || "나레이션"}
            </span>
            <span className={styles.holeItemScript}>{formatScript(hole.script ?? "")}</span>
          </span>
        </div>

        <div className={styles.inlineActions}>
          <button
            type="button"
            className={styles.previewButton}
            onClick={() => void handlePreview("guide")}
            disabled={!canPreviewGuide || !canInteractWhileRecording}
          >
            <img src="/icons/common/playBorder.svg" alt="" />
            <span>오리지널 듣기</span>
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className={recordingAreaClassName}>
          {showSampleImage ? (
            <div className={styles.sampleImageWrap}>
              <img
                ref={thumbnailImgRef}
                key={thumbnailSrcResolved}
                src={thumbnailSrcResolved}
                alt=""
                className={[
                  styles.sampleImage,
                  thumbnailVisible ? styles.sampleImageVisible : "",
                ].join(" ")}
                decoding="async"
                onLoad={handleThumbnailLoad}
                onError={handleThumbnailError}
              />
            </div>
          ) : null}

          {showRecordingPanel ? (
            <>
              <div className={styles.playerBar}>
                <button
                  type="button"
                  className={styles.stopButton}
                  onClick={
                    isRecording
                      ? handleRecordAction
                      : isPreviewPlaying
                        ? () => stopPreviewAudio({ resetProgress: true })
                        : undefined
                  }
                  disabled={!isRecording && !isPreviewPlaying}
                  aria-label={isRecording ? "녹음 종료" : "정지"}
                >
                  <span />
                </button>

                <div className={styles.progressTrack} aria-hidden>
                  <div
                    className={styles.progressThumb}
                    style={{ left: `${Math.max(0, Math.min(100, barProgress * 100))}%` }}
                  />
                </div>

                <button
                  type="button"
                  className={[
                    styles.secondaryControlBtn,
                    hasHoleRecording && !isRecording ? styles.secondaryControlBtnActive : "",
                  ].join(" ")}
                  onClick={() => void handlePreview("recording")}
                  disabled={!canPreviewRecording || !canInteractWhileRecording}
                >
                  미리듣기
                </button>
                <button
                  type="button"
                  className={[
                    styles.secondaryControlBtn,
                    hasHoleRecording && !isRecording ? styles.secondaryControlBtnActive : "",
                  ].join(" ")}
                  onClick={() => void handleRecordAction()}
                  disabled={isRecordingBusy || isSaving}
                >
                  다시 녹음
                </button>
              </div>

              <button
                type="button"
                className={styles.applyButton}
                onClick={() => void handleApplyRecording()}
                disabled={!canApplyRecording}
              >
                {isSaving ? "저장 중..." : "적용하기"}
              </button>
            </>
          ) : null}

          {!showRecordingPanel ? (
            <>
              <div className={styles.recordButtonFrame}>
                <button
                  type="button"
                  className={[
                    styles.recordMainBtn,
                    isRecording ? styles.recording : "",
                  ].join(" ")}
                  onClick={() => void handleRecordAction()}
                  disabled={isRecordingBusy || isSaving}
                >
                  <img src="/icons/common/mic.svg" alt="" />
                  <span>{recordButtonLabel}</span>
                </button>
              </div>
              <button
                type="button"
                className={styles.applyButton}
                onClick={() => void handleApplyRecording()}
                disabled={!canApplyRecording}
              >
                {isSaving ? "저장 중..." : "적용하기"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
