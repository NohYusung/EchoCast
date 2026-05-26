"use client";

import React from "react";
import RecordingHoleItem from "@/app/player/_components/dialog/recording/RecordingHoleItem";
import { useRecordingStore } from "@/stores/useRecordingStore";
import styles from "./RecordingIntegratedDialog.module.scss";

interface RecordingIntegratedDialogProps {
  episodeId: number;
  holes: Array<{
    uuid: string;
    script?: string;
    start_ms?: number;
    duration_ms?: number;
    characterName?: string;
    character_name?: string;
    thumbnailSrc?: string | null;
    records?: Array<{
      src?: string;
      rawSrc?: string;
      url?: string;
    }>;
  }>;
  onNavigateToScene?: (startMs: number) => void;
  onRecordingSaved?: () => void;
  /** 시범: 로컬 스토리지·서버 적용 없이 세션 내 미리듣기만 */
  trialEphemeralPlayback?: boolean;
}

interface ActivePreviewAudio {
  ownerId: string;
  audio: HTMLAudioElement;
}

export default function RecordingIntegratedDialog({
  episodeId,
  holes,
  onRecordingSaved,
  trialEphemeralPlayback = false,
}: RecordingIntegratedDialogProps) {
  const isOpen = useRecordingStore((state) => state.isOpen);
  const closeDialog = useRecordingStore((state) => state.closeDialog);
  const loadRecordings = useRecordingStore((state) => state.loadRecordings);
  const activePreviewAudioRef = React.useRef<ActivePreviewAudio | null>(null);
  const holeListScrollRef = React.useRef<HTMLDivElement | null>(null);
  const savedScrollTopRef = React.useRef(0);
  const shouldRestoreScrollRef = React.useRef(false);
  const hasPendingApplySyncRef = React.useRef(false);
  const [recordingBusyMap, setRecordingBusyMap] = React.useState<Record<string, boolean>>({});
  /** HTTP + localhost/127.0.0.1 이외 호스트(songpa.local.com 등)는 브라우저가 보안 컨텍스트로 인정하지 않아 마이크 API가 비활성화될 수 있음 */
  const [micBlockedByInsecureOrigin, setMicBlockedByInsecureOrigin] = React.useState(false);
  const sortedHoles = [...holes]
    .sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0));
  const hasActiveRecording = Object.values(recordingBusyMap).some(Boolean);

  const requestExclusivePreview = React.useCallback(
    (ownerId: string, audio: HTMLAudioElement) => {
      const currentPreview = activePreviewAudioRef.current;
      if (
        currentPreview &&
        currentPreview.audio !== audio &&
        currentPreview.ownerId !== ownerId
      ) {
        currentPreview.audio.pause();
      }

      activePreviewAudioRef.current = { ownerId, audio };
    },
    [],
  );

  const clearExclusivePreview = React.useCallback((audio: HTMLAudioElement) => {
    if (activePreviewAudioRef.current?.audio === audio) {
      activePreviewAudioRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setRecordingBusyMap({});
      setMicBlockedByInsecureOrigin(false);
      if (activePreviewAudioRef.current) {
        activePreviewAudioRef.current.audio.pause();
        activePreviewAudioRef.current = null;
      }
      return;
    }

    setMicBlockedByInsecureOrigin(
      typeof window !== "undefined" && window.isSecureContext === false,
    );

    if (!trialEphemeralPlayback) {
      loadRecordings(episodeId, "edu");
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      if (activePreviewAudioRef.current) {
        activePreviewAudioRef.current.audio.pause();
        activePreviewAudioRef.current = null;
      }
    };
  }, [episodeId, isOpen, loadRecordings, trialEphemeralPlayback]);

  const handleRecordingBusyChange = React.useCallback((holeUuid: string, isBusy: boolean) => {
    setRecordingBusyMap((prev) => {
      if (prev[holeUuid] === isBusy) {
        return prev;
      }
      return {
        ...prev,
        [holeUuid]: isBusy,
      };
    });
  }, []);

  const handleHoleListScroll = React.useCallback(() => {
    const el = holeListScrollRef.current;
    if (!el) return;
    savedScrollTopRef.current = el.scrollTop;
  }, []);

  React.useLayoutEffect(() => {
    if (!isOpen || !shouldRestoreScrollRef.current) return;
    const el = holeListScrollRef.current;
    if (!el) return;
    el.scrollTop = savedScrollTopRef.current;
    shouldRestoreScrollRef.current = false;
  }, [isOpen, holes]);

  const handleRecordingSaved = React.useCallback(() => {
    const el = holeListScrollRef.current;
    savedScrollTopRef.current = el?.scrollTop ?? savedScrollTopRef.current;
    shouldRestoreScrollRef.current = true;
    hasPendingApplySyncRef.current = true;
  }, []);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    if (hasActiveRecording) {
      return;
    }
    if (hasPendingApplySyncRef.current) {
      hasPendingApplySyncRef.current = false;
      onRecordingSaved?.();
    }
    closeDialog();
  };

  /** Figma: 확인은 항상 활성 — 모달만 닫음(마이 보이스 적용은 홀별「적용하기」·플레이어 토글에서 처리) */
  const handleConfirm = () => {
    if (hasActiveRecording) {
      return;
    }
    if (hasPendingApplySyncRef.current) {
      hasPendingApplySyncRef.current = false;
      onRecordingSaved?.();
    }
    closeDialog();
  };

  return (
    <div
      className={styles.recordingIntegratedOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="녹음하기"
      onClick={handleClose}
    >
      <div
        className={styles.recordingIntegratedDialog}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.top}>
          <h2>녹음하기</h2>
        </div>

        {micBlockedByInsecureOrigin ? (
          <div className={styles.micInsecureBanner} role="status">
            <p>
              마이크 녹음은 브라우저 정책상 HTTPS 또는 http://localhost(또는 127.0.0.1)에서만
              됩니다. 지금처럼 HTTP로 연 개발 도메인은 막힐 수 있어요.{" "}
              <span className={styles.micInsecureBannerEm}>
                yarn dev의 --hostname 0.0.0.0은 원인이 아니며, 같은 서버를{" "}
                <code className={styles.micInsecureBannerCode}>http://localhost:3000</code>으로 열면
                녹음이 동작하는 경우가 많습니다.
              </span>
            </p>
          </div>
        ) : null}

        <div
          ref={holeListScrollRef}
          className={styles.holeListContent}
          onScroll={handleHoleListScroll}
        >
          {sortedHoles.length > 0 ? (
            sortedHoles.map((hole, index) => (
              <RecordingHoleItem
                key={hole.uuid}
                episodeId={episodeId}
                itemIndex={index}
                hole={hole}
                onRequestExclusivePreview={requestExclusivePreview}
                onClearExclusivePreview={clearExclusivePreview}
                thumbnailSrc={hole.thumbnailSrc}
                onRecordingSaved={handleRecordingSaved}
                onRecordingBusyChange={handleRecordingBusyChange}
                trialEphemeralPlayback={trialEphemeralPlayback}
              />
            ))
          ) : (
            <div className={styles.emptyMessage}>녹음할 대사가 없습니다.</div>
          )}
        </div>

        <div className={styles.bottom}>
          <button
            type="button"
            className={styles.doneButton}
            onClick={handleConfirm}
            disabled={hasActiveRecording}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
