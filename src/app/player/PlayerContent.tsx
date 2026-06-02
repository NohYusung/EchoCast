import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { getImageMemoryCache, usePlayerStore } from "@/stores/usePlayerStore";
import { useToonWork } from "@/app/player/_lib/useToonWork";
import type { ContentVersion } from "@/app/player/_lib/useToonWork";
import {
  CARTOON_IMAGE_WIDTH_BASE,
  MarkerHelper,
  PositionCalculator,
} from "@/app/player/_lib/toonWorkCommon";
import PlayerHeader from "@/app/player/_components/PlayerHeader";
import PlayerLoadingbar from "@/app/player/_components/PlayerLoadingbar";
import { PlayerControlType } from "@/app/player/types";
import { playerLogger } from "@/app/player/_lib/playerLogger";
import { usePlayerState } from "@/app/player/_hooks/usePlayerState";
import { useScrollSync } from "@/app/player/_hooks/useScrollSync";
import { useImageLoading } from "@/app/player/_hooks/useImageLoading";
import { usePlayerControls } from "@/app/player/_hooks/usePlayerControls";
import { usePlayerInitialization } from "@/app/player/_hooks/usePlayerInitialization";
import { PlayerViewer } from "@/app/player/_components/PlayerViewer";
import { PlayerControls } from "@/app/player/_components/PlayerControls";
import RecordingIntegratedDialog from "@/app/player/_components/dialog/recording/RecordingIntegratedDialog";
import { useRecordingStore } from "@/stores/useRecordingStore";
import {
  buildServerRecordingMapsByHoleUuid,
  collectHolesFromContent,
  type EpisodeRecordingApiItem,
  fetchEpisodeRecordings,
} from "@/api/episodeRecordings";
import {
  resolveRecordingPreviewThumbnail,
  type RecordingPreviewDirectImageRef,
} from "@/app/player/_lib/recordingPreviewThumbnail";
import type { VogopangContentImage } from "@/data/vogopangContentTypes";
import type { PlayerEpisodeListItem } from "@/app/player/playerEpisodeListData";
import {
  chapterLabelForEpisodeListItem,
  stripDuplicateChapterLabelFromTitle,
} from "@/lib/playerInfoEpisodes";
import { useGlobalSnackBarStore } from "@/stores/useGlobalSnackBarStore";
import clsx from "clsx";
import { PlayerImmersivePeekOverlay } from "@/app/player/_components/PlayerImmersivePeekOverlay";
import { getPlayerImmersivePeekBottomOffset } from "@/app/player/_lib/playerChromeStackOffset";
import {
  resolvePlayerLoadingState,
  resolvePlayerPlaybackReadiness,
} from "@/app/player/_lib/playerPlaybackReadiness";
import {
  getPlaybackContentImages,
  getPlaybackContentSceneMarkers,
} from "@/lib/playbackContentAccess";
import {
  isSnappedBackwardToSceneStart,
  resolveSceneNavigateTimeMs,
  resolveTimelineSceneMarkers,
  type PlaybackSceneNavigationMarker,
} from "@/app/player/_lib/playbackSceneNavigation";
import { useCanBypassPlayerLoanGate } from "@/hooks/useCanBypassPlayerLoanGate";
import { useServiceMode } from "@/contexts/ServiceModeContext";
import { isLibraryServiceModeApiEnabled } from "@/lib/libraryServiceModeFlag";

interface PlayerContentProps {
  seriesId: number;
  episodeId: number;
  version: ContentVersion;
  /** URL `playerKey` — 에피소드 목록에서 현재 회차 표시용 */
  currentPlayerKey: string;
  backHref?: string | (() => void);
  title?: string;
  subtitle?: string;
  showExperienceEntry?: boolean;
  /** 작품 상세에서 진입 시 대출 여부 — null이면 알 수 없음(차단 안 함) */
  userHasLoan?: boolean | null;
}

export interface PlayerContentRef {
  handleStop: () => Promise<void>;
}

type SceneMarker = PlaybackSceneNavigationMarker;

function uuidAliasKeys(raw: unknown): string[] {
  const value = String(raw ?? "").trim();
  if (!value) {
    return [];
  }

  const lower = value.toLowerCase();
  const compact = lower.replace(/-/g, "");
  return Array.from(new Set([value, lower, compact]));
}

function normalizeHoleScript(raw: unknown): string {
  return String(raw ?? "")
    .replace(/^\((.*?)\)/, "")
    .replace(/\s+/g, "")
    .trim();
}

function hasDirectImageRef(ref: RecordingPreviewDirectImageRef | null | undefined): boolean {
  return Boolean(ref?.imageUuids?.length || ref?.imageSrcs?.length);
}

function resolveSceneNavigateTargetScrollTop(params: {
  startMs: number;
  sceneMarkers: Array<{ time_ms?: number }>;
  version: ContentVersion;
  contentList: HTMLElement | null;
  markers: SceneMarker[];
  workspaceImageScale: number;
  viewOffsetTop: number;
  calculatedWidth: number;
}): number | null {
  const {
    startMs,
    sceneMarkers,
    version,
    contentList,
    markers,
    workspaceImageScale,
    viewOffsetTop,
    calculatedWidth,
  } = params;

  if (!contentList || markers.length === 0) {
    return null;
  }

  const navigateTimeMs = resolveSceneNavigateTimeMs(startMs, sceneMarkers);
  const currentScrollTop = contentList.scrollTop ?? 0;
  const scrollHeight = contentList.scrollHeight ?? 0;
  const scrollRange = Math.max(1, scrollHeight - contentList.clientHeight);
  const scrollMarkers = markers.map((marker) => MarkerHelper.normalizeMarker(marker));

  const targetPosition =
    version === "V0"
      ? PositionCalculator.getPositionAtTimeV0(
          navigateTimeMs,
          scrollMarkers,
          scrollHeight,
          currentScrollTop,
        )
      : PositionCalculator.getPositionAtTimeV1(
          navigateTimeMs,
          scrollMarkers,
          workspaceImageScale,
          viewOffsetTop,
          currentScrollTop,
          calculatedWidth,
          CARTOON_IMAGE_WIDTH_BASE,
          scrollRange,
          scrollHeight,
        );

  return Math.min(scrollRange, Math.max(0, targetPosition));
}

function resolveRecordingPreviewForScene(params: {
  startMs: number;
  sceneMarkers: Array<{ time_ms?: number }>;
  images: VogopangContentImage[];
  version: ContentVersion;
  contentList: HTMLElement | null;
  markers: SceneMarker[];
  workspaceImageScale: number;
  viewOffsetTop: number;
  calculatedWidth: number;
  directImage?: RecordingPreviewDirectImageRef | null;
}) {
  const {
    startMs,
    sceneMarkers,
    images,
    version,
    contentList,
    markers,
    workspaceImageScale,
    viewOffsetTop,
    calculatedWidth,
    directImage,
  } = params;
  const navigateTimeMs = resolveSceneNavigateTimeMs(startMs, sceneMarkers);
  const targetScrollTop = resolveSceneNavigateTargetScrollTop({
    startMs,
    sceneMarkers,
    version,
    contentList,
    markers,
    workspaceImageScale,
    viewOffsetTop,
    calculatedWidth,
  });

  return resolveRecordingPreviewThumbnail({
    holeStartMs: startMs,
    sceneMarkers,
    images,
    contentList,
    markers,
    version,
    targetScrollTop,
    directImage,
    isSnappedBackwardToSceneStart: isSnappedBackwardToSceneStart({
      requestedMs: startMs,
      navigateTimeMs,
    }),
  });
}

/** SSR·테스트에서는 온라인으로 간주 */
function readNavigatorOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

const PlayerContent = forwardRef<PlayerContentRef, PlayerContentProps>(
  ({
    seriesId = 0,
    episodeId = 0,
    version = "V0",
    backHref,
    title = "",
    subtitle = "",
    showExperienceEntry = false,
    userHasLoan = null,
    currentPlayerKey,
  }, ref) => {
    const MAX_AUTO_RETRY_COUNT = 1;
    const LOADING_TIMEOUT_MS = 30_000;
    const INIT_LOAD_RETRYING_MESSAGE =
      "콘텐츠 로딩에 실패했습니다. 다시 시도 중입니다...";
    const INIT_LOAD_OFFLINE_RETRYING_MESSAGE =
      "인터넷 연결이 끊어진 것 같습니다. 연결이 복구되면 자동으로 다시 시도합니다...";
    const INIT_LOAD_FINAL_MESSAGE =
      "콘텐츠 로딩에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.";
    const INIT_LOAD_OFFLINE_FINAL_MESSAGE =
      "인터넷 연결이 끊어진 것 같습니다. Wi-Fi 또는 데이터 연결을 확인한 뒤 아래에서 다시 시도해 주세요.";
    const INIT_LOAD_RECONNECTED_HINT_MESSAGE =
      "연결이 복구된 것 같습니다. 아래 ‘다시 시도’를 눌러 콘텐츠를 불러와 주세요.";

    const isInitLoadFinalOverlayMessage = (m: string | null) =>
      m === INIT_LOAD_FINAL_MESSAGE ||
      m === INIT_LOAD_OFFLINE_FINAL_MESSAGE ||
      m === INIT_LOAD_RECONNECTED_HINT_MESSAGE;

    const router = useRouter();
    const playerStore = usePlayerStore();
    const setEpisodeListOpen = usePlayerStore((s) => s.setEpisodeListOpen);
    const showSnackBar = useGlobalSnackBarStore((s) => s.showSnackBar);
    /** 스토어 부분 갱신 시 content 참조만 바뀌는 경우 effect 무한 루프 방지 */
    /** tracks/holes 개수 제외 — 비동기로 채워질 때 키가 바뀌며 에러·재시도 상태가 초기화되는 것 방지 */
    const playerContentIdentityKey = usePlayerStore((s) => {
      const c = s.content;
      const images = getPlaybackContentImages(c);
      if (!images.length) return "";
      const img0 = String(images[0]?.uuid ?? "");
      const nImg = images.length;
      const audioCue0 = c?.playback_manifest?.audioCues[0];
      const clip0 = c?.audio_tracks?.[0]?.clips?.[0];
      const durMs = String(audioCue0?.durationMs ?? clip0?.duration_ms ?? "0");
      const trimL = String(audioCue0?.trimLeftMs ?? clip0?.trim_left_ms ?? "0");
      const trimR = String(audioCue0?.trimRightMs ?? clip0?.trim_right_ms ?? "0");
      const mediaCue0 = c?.playback_manifest?.visualCues.find(
        (cue) => cue.type === "inline-media",
      );
      const media0 = c?.inline_media?.[0];
      const mediaKey = mediaCue0
        ? [
            mediaCue0.sourceRef?.id ?? mediaCue0.id,
            mediaCue0.startMs,
            mediaCue0.durationMs,
          ].join(":")
        : media0
          ? [
              media0.src,
              media0.after_image_order,
              media0.start_ms ?? 0,
              media0.duration_ms ?? 0,
            ].join(":")
          : "";
      return `${img0}|${nImg}|${String(c?.format_version ?? "")}|${durMs}|${trimL}|${trimR}|${mediaKey}`;
    });
    const searchParams = useSearchParams();
    const urlEpisodeId = useMemo(() => {
      const raw = searchParams.get("episodeId");
      return raw ? Number(raw) : 0;
    }, [searchParams]);

    const serviceMode = useServiceMode();
    const trialEphemeralRecording =
      isLibraryServiceModeApiEnabled() &&
      serviceMode.isReady &&
      !serviceMode.error &&
      serviceMode.serviceType === "trial";
    const canBypassLoanGateInTrialMode = useCanBypassPlayerLoanGate();

    const playerSeriesEpisodeNav = usePlayerStore((s) => s.playerSeriesEpisodeNav);
    const isEpisodeListOpen = usePlayerStore((s) => s.isEpisodeListOpen);
    const playerContentForSceneMarkers = usePlayerStore((s) => s.content);
    const playerContentSceneMarkers = useMemo(
      () => getPlaybackContentSceneMarkers(playerContentForSceneMarkers),
      [playerContentForSceneMarkers],
    );

    const { headerTitle, headerSubtitle } = useMemo(() => {
      const eid = episodeId > 0 ? episodeId : urlEpisodeId;
      const items = playerSeriesEpisodeNav?.items;
      const item =
        items && items.length > 0 && Number.isFinite(eid) && eid > 0
          ? items.find((i) => i.id === eid)
          : undefined;
      if (item) {
        const chapterLine = chapterLabelForEpisodeListItem(item);
        const rawName = item.title.trim() || `회차 ${item.id}`;
        let epName = stripDuplicateChapterLabelFromTitle(rawName, chapterLine);
        if (!epName && rawName !== chapterLine) epName = rawName;
        /** `PLAYER_HEADER_META` 등 부모가 `체험하기 : …` 형태로 넘긴 경우에만 동일 접두 유지 */
        const useExperienceSubtitlePrefix = /체험하기\s*:/.test(subtitle);
        const sub =
          useExperienceSubtitlePrefix && epName
            ? `체험하기 : ${epName}`
            : epName;
        return { headerTitle: chapterLine, headerSubtitle: sub };
      }
      return { headerTitle: title, headerSubtitle: subtitle };
    }, [playerSeriesEpisodeNav, episodeId, urlEpisodeId, title, subtitle]);

    /** 녹음 로컬 스토리지·setupVoice loadRecordings 키 — props가 0일 때 URL 쿼리 사용 */
    const resolvedRecordingEpisodeId = episodeId || urlEpisodeId;

    // playerStore에서 직접 사용
    const isClearText = playerStore.isClearText;
    const isMuted = playerStore.isMuted;

    // Custom Hook으로 모든 state와 ref 관리
    const state = usePlayerState();

    // Destructure for convenience (기존 코드와 호환성 유지)
    const {
      setIsAutoPlay,
      isPlaying, setIsPlaying,
      setIsPaused,
      loadedImagesCount, setLoadedImagesCount,
      loadedClearTextImagesCount, setLoadedClearTextImagesCount,
      showContent, setShowContent,
      toonBoxRef,
      clearTextToonBoxRef,
      baseToonWorkRef,
      clearTextBaseToonWorkRef,
      scrollPositionRef,
      isScrollSyncEnabled,
      overlayRef,
      totalImagesRef,
      totalClearTextImagesRef,
      showContentTimeoutRef,
      autoPlayAttemptedRef,
      toonWorkCleanupRef,
      prevSeriesIdRef,
      prevEpisodeIdRef,
      dataLoadRequestedRef,
      isPreloading,
      setIsPreloading,
      preloadProgress,
      setPreloadProgress,
    } = state;

    const [immersivePeekVisible, setImmersivePeekVisible] = useState(false);
    const [playbackTimeMs, setPlaybackTimeMs] = useState(0);
    const [loadingErrorMessage, setLoadingErrorMessage] = useState<string | null>(null);
    const [initializationRetrySeed, setInitializationRetrySeed] = useState(0);
    /** 자동 재시도 소진 여부 — ref만 사용(비동기 catch·타임아웃과 state 불일치 방지) */
    const autoRetriedCountRef = useRef(0);
    const loadingTimeoutRef = useRef<number | null>(null);
    const playbackTimeUpdateAtRef = useRef(0);
    /** Next `useSearchParams` 보강으로 (0,0)→(series,episode)로만 바뀌는 프레임이 있어, 그때 에러 UI를 지우지 않음 */
    const prevSeriesEpisodeForErrorResetRef = useRef<{
      seriesId: number;
      episodeId: number;
    } | null>(null);

    // loadedImagesCount를 ref로도 유지하여 클로저 문제 해결
    const loadedImagesCountRef = React.useRef(loadedImagesCount);
    React.useEffect(() => {
      loadedImagesCountRef.current = loadedImagesCount;
    }, [loadedImagesCount]);

    // sessionStorage에서 정주행 모드 상태 읽기 (UI 표시용)
    useEffect(() => {
      const updateAutoPlayState = () => {
        setIsAutoPlay(sessionStorage.getItem('isAutoPlay') === 'true');
      };

      // 초기값 설정
      updateAutoPlayState();

      // storage 이벤트 리스너 (다른 탭에서 변경 시)
      window.addEventListener('storage', updateAutoPlayState);

      // 주기적으로 확인 (같은 탭 내에서 변경 시)
      const interval = setInterval(updateAutoPlayState, 100);

      return () => {
        window.removeEventListener('storage', updateAutoPlayState);
        clearInterval(interval);
      };
    }, [setIsAutoPlay]);

    // useToonWork의 progress 업데이트를 preloadProgress와 통합 (percentage 기반)
    const handleProgressUpdate = useCallback((progress: { step: string; percentage: number }) => {
      setPreloadProgress(progress);
    }, [setPreloadProgress]);

    const handleTimelineTimeUpdate = useCallback((timeMs: number) => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - playbackTimeUpdateAtRef.current < 150) return;
      playbackTimeUpdateAtRef.current = now;
      setPlaybackTimeMs(timeMs);
    }, []);

    const handlePlaybackComplete = useCallback(async () => {
      playerLogger.log("[PlayerContent] Playback complete");

      // sessionStorage에서 직접 읽기
      const isAutoPlay = sessionStorage.getItem('isAutoPlay') === 'true';
      const isInitAutoPlay = sessionStorage.getItem('isInitAutoPlay') === 'true';

      playerLogger.log("[PlayerContent] 정주행 모드 상태:", {
        isAutoPlay,
        isInitAutoPlay,
      });

      // 재생 완료 시에는 몰입 모드를 해제해 상/하단 컨트롤 바를 다시 노출한다.
      setIsPlaying(false);
      setIsPaused(false);
      setImmersivePeekVisible(false);

      // vogopang: 단일 콘텐츠라 다음 회차 없음.
      if (isAutoPlay) {
        playerLogger.log("[PlayerContent] 재생 완료 (vogopang 단일 콘텐츠)");
      } else {
        playerLogger.log("[PlayerContent] 재생 완료");
      }
    }, [setIsPaused, setIsPlaying]);

    // 버전에 따라 다른 훅 사용
    const toonWork = useToonWork({
      version: version as ContentVersion,
      site: 'edu',
      skipStoredRecordings: trialEphemeralRecording,
      recordingEpisodeId: resolvedRecordingEpisodeId,
      onComplete: handlePlaybackComplete,
      onProgressUpdate: handleProgressUpdate,
      onTimeUpdate: handleTimelineTimeUpdate,
    });

    // 플레이어 컨트롤 Hook (handleStop, handleControl, handlePlayClick)
    const { handleStop, handleControl, handlePlayClick } = usePlayerControls({
      currentPlayerKey,
      currentEpisodeId: episodeId,
      toonWork,
      toonWorkCleanupRef,
      playerStore,
      setIsPlaying,
      setIsPaused,
      loadedImagesCount,
      totalImagesRef,
    });

    // 미대출 상태에서 다음화/이전화 이동 차단
    const handleControlGuarded = useCallback(
      async (type: PlayerControlType, options?: unknown) => {
        if (
          userHasLoan === false &&
          !canBypassLoanGateInTrialMode &&
          (type === PlayerControlType.next || type === PlayerControlType.prev)
        ) {
          showSnackBar("대출 이후 열람이 가능합니다.");
          return;
        }
        return handleControl(type, options);
      },
      [userHasLoan, canBypassLoanGateInTrialMode, showSnackBar, handleControl],
    );

    const immersiveChromeHidden = isPlaying && showContent;
    const playbackReadiness = resolvePlayerPlaybackReadiness({
      isInitializing: toonWork.isInitializing,
      resourceLoadingCount: toonWork.loadingCount,
      playerStoreLoading: playerStore.loading,
    });

    useEffect(() => {
      setImmersivePeekVisible(false);
    }, [isPlaying]);

    /** pointerup 직후 click이 이어져 피크가 켜졌다 꺼지는 것 방지 (모바일 웹) */
    const lastImmersiveTapAtRef = useRef(0);
    const IMMERSIVE_TAP_DEBOUNCE_MS = 450;

    const handleImmersiveTap = useCallback(() => {
      const now = Date.now();
      if (now - lastImmersiveTapAtRef.current < IMMERSIVE_TAP_DEBOUNCE_MS) {
        return;
      }
      lastImmersiveTapAtRef.current = now;
      setImmersivePeekVisible((v) => !v);
    }, []);

    const handleImmersivePause = useCallback(async () => {
      setImmersivePeekVisible(false);
      await handleControlGuarded(PlayerControlType.pause);
    }, [handleControlGuarded]);

    const handleImmersiveMute = useCallback(() => {
      void handleControlGuarded(PlayerControlType.muted);
    }, [handleControlGuarded]);

    // useImperativeHandle로 부모 컴포넌트에서 호출할 수 있는 함수 노출
    useImperativeHandle(
      ref,
      () => ({
        handleStop,
      }),
      [handleStop]
    );

    const handleStopRef = useRef(handleStop);
    handleStopRef.current = handleStop;

    /** 뒤로가기·라우트 이탈 시 자식이 먼저 언마운트되면 부모 `ref.current`가 null이라 `PlayerPage`의 stop이 스킵될 수 있음 */
    useLayoutEffect(() => {
      return () => {
        void handleStopRef.current();
      };
    }, []);

    // Keep toonWorkCleanupRef updated with latest toonWork
    useEffect(() => {
      toonWorkCleanupRef.current = toonWork;
    }, [toonWork, toonWorkCleanupRef]);

    // 플레이어 초기화 Hook (티켓 기반 데이터 로드 및 toonWork 초기화)
    const triggerInitializationRetry = useCallback(
      (reason: string) => {
        if (autoRetriedCountRef.current < MAX_AUTO_RETRY_COUNT) {
          autoRetriedCountRef.current += 1;
          const nextCount = autoRetriedCountRef.current;
          playerLogger.warn(
            `[PlayerContent] 콘텐츠 로딩 실패(${reason}) - 자동 재시도 ${nextCount}/${MAX_AUTO_RETRY_COUNT}`,
          );
          setLoadingErrorMessage(
            readNavigatorOnline()
              ? INIT_LOAD_RETRYING_MESSAGE
              : INIT_LOAD_OFFLINE_RETRYING_MESSAGE,
          );
          setShowContent(false);
          setIsPlaying(false);
          setIsPaused(false);
          setInitializationRetrySeed((seed) => seed + 1);
          return;
        }

        playerLogger.error(
          `[PlayerContent] 콘텐츠 로딩 최종 실패(${reason}) - 사용자 수동 재시도 필요`,
        );
        setLoadingErrorMessage(
          readNavigatorOnline() ? INIT_LOAD_FINAL_MESSAGE : INIT_LOAD_OFFLINE_FINAL_MESSAGE,
        );
        setShowContent(false);
        setIsPlaying(false);
        setIsPaused(false);
        setIsPreloading(false);
        void toonWorkCleanupRef.current
          .cleanup()
          .catch((e: unknown) => {
            playerLogger.warn("[PlayerContent] 최종 실패 후 cleanup 실패:", e);
          });
      },
      [setIsPaused, setIsPlaying, setShowContent, setIsPreloading, toonWorkCleanupRef],
    );

    const onInitializationError = useCallback(
      (error: unknown) => {
        const reason =
          error instanceof Error && error.message ? error.message : "initialization_error";
        triggerInitializationRetry(reason);
      },
      [triggerInitializationRetry],
    );

    const handleManualRetry = useCallback(() => {
      playerLogger.log("[PlayerContent] 수동 재시도 시작");
      autoRetriedCountRef.current = 0;
      setLoadingErrorMessage(null);
      setInitializationRetrySeed((seed) => seed + 1);
    }, []);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const onOnline = () => {
        setLoadingErrorMessage((prev) =>
          prev === INIT_LOAD_OFFLINE_FINAL_MESSAGE
            ? INIT_LOAD_RECONNECTED_HINT_MESSAGE
            : prev,
        );
      };
      window.addEventListener("online", onOnline);
      return () => window.removeEventListener("online", onOnline);
    }, []);

    useEffect(() => {
      const prev = prevSeriesEpisodeForErrorResetRef.current;
      if (
        prev != null &&
        prev.seriesId === seriesId &&
        prev.episodeId === episodeId
      ) {
        return;
      }

      const isHydrationFromZeros =
        prev != null &&
        prev.seriesId === 0 &&
        prev.episodeId === 0 &&
        (seriesId !== 0 || episodeId !== 0);

      prevSeriesEpisodeForErrorResetRef.current = { seriesId, episodeId };

      if (prev == null || isHydrationFromZeros) {
        return;
      }

      autoRetriedCountRef.current = 0;
      setLoadingErrorMessage(null);
      setInitializationRetrySeed(0);
    }, [seriesId, episodeId]);

    usePlayerInitialization({
      seriesId,
      episodeId,
      prevSeriesIdRef,
      prevEpisodeIdRef,
      dataLoadRequestedRef,
      toonWorkCleanupRef,
      totalImagesRef,
      totalClearTextImagesRef,
      autoPlayAttemptedRef,
      setIsPlaying,
      setIsPaused,
      setLoadedImagesCount,
      setLoadedClearTextImagesCount,
      setShowContent,
      setIsPreloading,
      setPreloadProgress,
      playerContentIdentityKey,
      retrySeed: initializationRetrySeed,
      onInitializationError,
    });

    // 티켓 기반 데이터 로드 및 초기화는 usePlayerInitialization에서 처리

    // Monitor loadingCount and update loading state
    // (비동기 리소스 로딩이 initializeVoiceToon 완료 후에도 진행될 수 있으므로 추가 모니터링)
    useEffect(() => {
      // 조건 1: 초기화가 완료되어야 함
      const initializationComplete = !toonWork.isInitializing;

      // 조건 2: loadingCount === 0 (오디오 + 보이스 로딩 완료)
      const allResourcesLoaded = toonWork.loadingCount === 0;

      // 조건 3: 두 레이어의 모든 이미지가 렌더링 완료되어야 함
      // 모든 리소스가 준비됨
      const isReady =
        initializationComplete &&
        allResourcesLoaded &&
        !playerStore.loading;

      // 모든 조건이 만족되면 로딩 완료
      if (initializationComplete && allResourcesLoaded && playerStore.loading) {
        playerStore.setLoading(false);

        // 이미지가 모두 로드되었으므로 즉시 컨텐츠 표시
        setShowContent(true);
        if (showContentTimeoutRef.current) {
          clearTimeout(showContentTimeoutRef.current);
          showContentTimeoutRef.current = null;
        }

        // 화면 크기 재계산 (reload 시 정확한 계산을 위한 안전장치)
        playerLogger.log('[PlayerContent] 리소스 로딩 완료 - 화면 크기 최종 재계산');
        toonWork.handleResize();
      }

      // 정주행 모드로 다음 화로 넘어온 경우 모든 리소스 준비되면 자동 재생 (한 번만)
      // isPendingPlay가 true이면 사용자가 재생 버튼을 눌렀으므로 중복 재생 방지
      if (isReady && !isPlaying && !autoPlayAttemptedRef.current) {
        const isAutoPlayMode = sessionStorage.getItem('isAutoPlay') === 'true';

        if (isAutoPlayMode) {
          playerLogger.log(
            "[PlayerContent] 정주행 모드 - 리소스 준비 완료, 자동 재생 시작"
          );
          autoPlayAttemptedRef.current = true; // 플래그 설정으로 재시도 방지
          handleControl(PlayerControlType.play);
        }
      }
    }, [
      toonWork.isInitializing,
      toonWork.loadingCount,
      loadedImagesCount,
      loadedClearTextImagesCount,
      playerStore.loading,
      toonWork.initializationProgress,
      isPlaying,
      handleControl,
      autoPlayAttemptedRef,
      totalImagesRef,
      totalClearTextImagesRef,
      playerStore,
      seriesId,
      setShowContent,
      showContentTimeoutRef,
      toonWork,
    ]);

    // visibilitychange 이벤트 핸들러: 화면을 벗어날 경우 재생 중지, 복귀 시 상태 복구
    useEffect(() => {
      const handleVisibilityChange = async () => {
        if (document.hidden) {
          // 백그라운드로 전환될 때
          if (isPlaying) {
            playerLogger.log("[PlayerContent] 화면 숨김 감지 -> 재생 중지");
            handleControl(PlayerControlType.stop);
          }
        } else {
          // 포그라운드로 복귀할 때 - Proactive Resume
          playerLogger.log("[PlayerContent] 화면 복귀 감지 - AudioContext 복구 시작");
          try {
            const Tone = await import("tone");

            // AudioContext 상태 확인
            playerLogger.log("[PlayerContent] 현재 AudioContext 상태:", Tone.getContext().state);

            // suspended 상태면 즉시 resume 시도
            const contextState = Tone.getContext().state as AudioContextState;
            if (contextState === "suspended") {
              playerLogger.log("[PlayerContent] AudioContext suspended 감지 - 즉시 resume 시도");

              try {
                await Tone.getContext().resume();
                playerLogger.log("[PlayerContent] AudioContext resume 완료, 상태:", Tone.getContext().state);

                // resume 후에도 running이 아니면 재시도
                let retryCount = 0;
                while (retryCount < 5) {
                  const currentState = Tone.getContext().state as AudioContextState;
                  if (currentState === "running") {
                    playerLogger.log("[PlayerContent] AudioContext 복구 성공");
                    break;
                  }

                  playerLogger.log(`[PlayerContent] resume 재시도 ${retryCount + 1}/5`);
                  await new Promise(resolve => setTimeout(resolve, 200));
                  await Tone.getContext().resume();
                  retryCount++;
                }

                const finalState = Tone.getContext().state as AudioContextState;
                if (finalState !== "running") {
                  playerLogger.warn("[PlayerContent] AudioContext가 running 상태가 되지 않음:", finalState);
                }
              } catch (resumeError) {
                playerLogger.error("[PlayerContent] AudioContext resume 실패:", resumeError);
              }
            } else if (contextState === "closed") {
              playerLogger.error("[PlayerContent] AudioContext가 closed 상태입니다. 페이지 새로고침이 필요할 수 있습니다.");
            } else {
              playerLogger.log("[PlayerContent] AudioContext 상태 정상:", contextState);
            }
          } catch (error) {
            playerLogger.error(
              "[PlayerContent] visibilitychange 복귀 처리 중 오류:",
              error
            );
          }
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
      };
    }, [isPlaying, handleControl]);

    // Assign toonWorkRef - isClearText에 따라 적절한 ref 할당
    useEffect(() => {
      if (isClearText && clearTextBaseToonWorkRef.current) {
        toonWork.toonWorkRef.current = clearTextBaseToonWorkRef.current;
      } else if (!isClearText && baseToonWorkRef.current) {
        toonWork.toonWorkRef.current = baseToonWorkRef.current;
      }
    }, [isClearText, baseToonWorkRef, clearTextBaseToonWorkRef, toonWork]);

    /**
     * 모바일에서 주소창/툴바 변화 등으로 `visualViewport`가 변하면
     * `window.resize` 없이 레이아웃(특히 V1 calculatedWidth)이 바뀔 수 있다.
     * top/scrollHeight 기반 로직이 덜 흔들리도록, viewport 변화 시 toonWork의 스케일 계산을 갱신한다.
     */
    useEffect(() => {
      let timer: number | null = null;
      const scheduleResize = () => {
        if (timer != null) {
          window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
          timer = null;
          toonWork.handleResize();
        }, 120);
      };

      window.addEventListener("resize", scheduleResize);
      const vv = window.visualViewport;
      vv?.addEventListener("resize", scheduleResize);
      // 모바일 브라우저는 스크롤 중에도 visualViewport height가 바뀌는 경우가 있어 보강한다.
      vv?.addEventListener("scroll", scheduleResize);

      // 초기 1회 — 초기 렌더 직후 측정값 안정화
      scheduleResize();

      return () => {
        if (timer != null) {
          window.clearTimeout(timer);
          timer = null;
        }
        window.removeEventListener("resize", scheduleResize);
        vv?.removeEventListener("resize", scheduleResize);
        vv?.removeEventListener("scroll", scheduleResize);
      };
    }, [toonWork]);

    // 초기 로드 시 스크롤 동기화 및 isClearText 변경 시 스크롤 복원은 useScrollSync에서 처리

    // 이미지 우클릭 방지 및 드래그 방지
    useEffect(() => {
      const handleContextMenu = (e: MouseEvent) => {
        // 이미지에 대한 우클릭 방지
        if (e.target instanceof HTMLImageElement) {
          e.preventDefault();
          return false;
        }
      };

      const handleDragStart = (e: DragEvent) => {
        // 이미지 드래그 방지
        if (e.target instanceof HTMLImageElement) {
          e.preventDefault();
          return false;
        }
      };

      const handleSelectStart = (e: Event) => {
        // 이미지 선택 방지
        if (e.target instanceof HTMLImageElement) {
          e.preventDefault();
          return false;
        }
      };

      // 전역 이벤트 리스너 등록
      document.addEventListener("contextmenu", handleContextMenu);
      document.addEventListener("dragstart", handleDragStart);
      document.addEventListener("selectstart", handleSelectStart);

      return () => {
        // 이벤트 리스너 정리
        document.removeEventListener("contextmenu", handleContextMenu);
        document.removeEventListener("dragstart", handleDragStart);
        document.removeEventListener("selectstart", handleSelectStart);
      };
    }, []);
    // 이미지 전환 시 스크롤 위치는 자동으로 동기화되어 있으므로 별도 처리 불필요
    // 두 레이어가 항상 동일한 스크롤 위치를 유지함

    // 이미지 로딩 Hook
    const { getImageUrl, getImageKey, handleImageLoad, handleClearTextImageLoad } = useImageLoading({
      version,
      totalImagesRef,
      totalClearTextImagesRef,
      baseToonWorkRef,
      clearTextBaseToonWorkRef,
      loadedImagesCount,
      setLoadedImagesCount,
      loadedClearTextImagesCount,
      setLoadedClearTextImagesCount,
      toonWorkHandleResize: toonWork.handleResize,
    });

    // Overlay의 passive 이벤트 리스너 경고 해결
    useEffect(() => {
      const overlayElement = overlayRef.current;
      if (!overlayElement || !isPlaying) return;

      const preventDefaultAndStopPropagation = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };

      const handleTouchEnd = (e: TouchEvent) => {
        handleControl(PlayerControlType.touch);
        preventDefaultAndStopPropagation(e);
      };

      const handleMouseDown = (e: MouseEvent) => {
        preventDefaultAndStopPropagation(e);
      };

      const handleWheel = (e: WheelEvent) => {
        preventDefaultAndStopPropagation(e);
      };

      const handleScroll = (e: Event) => {
        preventDefaultAndStopPropagation(e);
      };

      // Passive: false 로 이벤트 리스너 등록
      // 'touchmove'는 일반적으로 스크롤 방지에 사용되나, 여기서는 이미 touch-action: manipulation이 적용된 것으로 보임.
      // 'touchstart', 'touchend', 'wheel', 'mousedown', 'scroll'에 대해 preventDefault가 필요한 경우 명시적으로 passive: false 설정.
      overlayElement.addEventListener(
        "touchstart",
        preventDefaultAndStopPropagation,
        { passive: false }
      );
      overlayElement.addEventListener("touchend", handleTouchEnd, {
        passive: false,
      });
      overlayElement.addEventListener("mousedown", handleMouseDown, {
        passive: false,
      });
      overlayElement.addEventListener("wheel", handleWheel, { passive: false });
      overlayElement.addEventListener("scroll", handleScroll, {
        passive: false,
      });

      return () => {
        overlayElement.removeEventListener(
          "touchstart",
          preventDefaultAndStopPropagation
        );
        overlayElement.removeEventListener("touchend", handleTouchEnd);
        overlayElement.removeEventListener("mousedown", handleMouseDown);
        overlayElement.removeEventListener("wheel", handleWheel);
        overlayElement.removeEventListener("scroll", handleScroll);
      };
    }, [isPlaying, handleControl, overlayRef]);

    // 로딩바에 표시할 진행률 및 메시지 계산 (프리로드 + 초기화 통합)
    const loadingState = resolvePlayerLoadingState({
      isPreloading,
      isInitializing: toonWork.isInitializing,
      resourceLoadingCount: toonWork.loadingCount,
      hasFinalLoadingError: isInitLoadFinalOverlayMessage(loadingErrorMessage),
    });
    const isLoading = loadingState.isLoading;
    const getLoadingProgress = () => {
      // percentage 기반으로 직접 반환 (0-100%)
      if (preloadProgress.percentage !== undefined) {
        return preloadProgress.percentage;
      }
      return null;
    };

    const getLoadingMessage = () => {
      return loadingErrorMessage ?? preloadProgress.step ?? "로딩 중...";
    };

    useEffect(() => {
      if (!isLoading || isInitLoadFinalOverlayMessage(loadingErrorMessage)) {
        if (loadingTimeoutRef.current != null) {
          window.clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
        return;
      }

      if (loadingTimeoutRef.current != null) return;

      loadingTimeoutRef.current = window.setTimeout(() => {
        loadingTimeoutRef.current = null;
        triggerInitializationRetry("loading_timeout");
      }, LOADING_TIMEOUT_MS);

      return () => {
        if (loadingTimeoutRef.current != null) {
          window.clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      };
    }, [isLoading, loadingErrorMessage, triggerInitializationRetry]);

    // 스크롤 동기화 Hook
    const { handleNormalScroll, handleClearTextScroll } = useScrollSync({
      toonBoxRef,
      clearTextToonBoxRef,
      scrollPositionRef,
      isScrollSyncEnabledRef: isScrollSyncEnabled,
      isClearText,
      playerStoreLoading: playerStore.loading,
    });

    useEffect(() => {
      const store = useRecordingStore.getState();
      store.setUseUserRecording(false);
      store.exitRecordingMode();
    }, [playerContentIdentityKey]);

    useEffect(() => {
      if (!trialEphemeralRecording) return;
      return () => {
        const store = useRecordingStore.getState();
        for (const r of store.recordings) {
          const u = r.blobUrl;
          if (typeof u === "string" && u.startsWith("blob:")) {
            URL.revokeObjectURL(u);
          }
        }
        store.setRecordings([]);
        store.setUseUserRecording(false);
      };
    }, [trialEphemeralRecording]);

    // re-fetch 트리거: 녹음 POST 후 카운터 증가 → useEffect 재실행
    const [holesFetchVersion, setHolesFetchVersion] = useState(0);
    const [serverEpisodeHoles, setServerEpisodeHoles] = useState<EpisodeRecordingApiItem[]>([]);

    const refetchServerRecordings = useCallback(() => {
      setHolesFetchVersion((v) => v + 1);
    }, []);

    const serverEpisodeHolesWithContentMeta = useMemo(() => {
      const contentHoles = (toonWork.getAllHoles?.() ?? [])
        .filter((hole) => hole?.uuid)
        .sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0));

      const contentHoleByUuid = new Map<string, (typeof contentHoles)[number]>();
      const contentHoleByScript = new Map<string, (typeof contentHoles)[number]>();
      const contentHoleByStartMs = new Map<number, (typeof contentHoles)[number]>();
      for (const hole of contentHoles) {
        for (const key of [...uuidAliasKeys(hole.uuid), ...uuidAliasKeys(hole.script_uuid)]) {
          contentHoleByUuid.set(key, hole);
        }
        if (Number.isFinite(hole.start_ms)) {
          contentHoleByStartMs.set(Math.round(hole.start_ms), hole);
        }
        const normalizedScript = normalizeHoleScript(hole.script);
        if (normalizedScript && !contentHoleByScript.has(normalizedScript)) {
          contentHoleByScript.set(normalizedScript, hole);
        }
      }

      return serverEpisodeHoles
        .map((item, index) => {
          const matchedByUuid = uuidAliasKeys(item.uuid)
            .map((key) => contentHoleByUuid.get(key))
            .find(Boolean);
          const itemStartMs = Number.isFinite(item.startMs) ? item.startMs : undefined;
          const matchedByStartMs =
            itemStartMs == null
              ? undefined
              : contentHoleByStartMs.get(Math.round(itemStartMs)) ??
                contentHoles
                  .map((hole) => ({
                    hole,
                    diff: Math.abs((hole.start_ms ?? 0) - itemStartMs),
                  }))
                  .sort((a, b) => a.diff - b.diff)[0]?.hole;
          const normalizedItemScript = normalizeHoleScript(item.script);
          const contentHole =
            matchedByUuid ??
            matchedByStartMs ??
            (normalizedItemScript ? contentHoleByScript.get(normalizedItemScript) : undefined);
          const directImage: RecordingPreviewDirectImageRef = {
            imageUuids: item.imageUuids ?? [],
            imageSrcs: item.imageSrcs ?? [],
          };
          return {
            item,
            holeIndex: index,
            /** 콘텐츠 JSON 트랙 hole.uuid — 녹음 저장·setupVoice 조회 키를 API uuid와 맞춤 */
            contentHoleUuid: contentHole?.uuid,
            startMs: itemStartMs ?? item.trialStartMs ?? contentHole?.start_ms ?? 0,
            durationMs: item.durationMs ?? item.trialDurationMs ?? contentHole?.duration_ms,
            directImage: hasDirectImageRef(directImage) ? directImage : null,
            guideRecords:
              contentHole?.records && contentHole.records.length > 0
                ? contentHole.records
                : item.trialGuideSrc
                  ? [{ src: item.trialGuideSrc }]
                  : [],
          };
        })
        .sort((a, b) => a.startMs - b.startMs);
    }, [serverEpisodeHoles, toonWork]);

    const recordingDialogHoles = useMemo(() => {
      const imageLoadTick = loadedImagesCount;
      void imageLoadTick;
      const images = getPlaybackContentImages(playerStore.content);
      const contentList = toonWork.getToonContentImageList();
      const playbackMarkers = toonWork.getMarkers?.() ?? [];
      const markers = resolveTimelineSceneMarkers(playbackMarkers, playerContentSceneMarkers);

      return serverEpisodeHolesWithContentMeta.map((hole) => {
        const preview = resolveRecordingPreviewForScene({
          startMs: hole.startMs,
          sceneMarkers: playerContentSceneMarkers,
          images,
          contentList,
          markers,
          version,
          workspaceImageScale: toonWork.workspaceOptions?.image_scale ?? 1,
          viewOffsetTop: toonWork.newViewOffsetTop(),
          calculatedWidth: toonWork.calculatedWidth,
          directImage: hole.directImage,
        });

        return {
          uuid: hole.contentHoleUuid ?? hole.item.uuid,
          script: hole.item.script,
          start_ms: hole.startMs,
          duration_ms: hole.durationMs,
          characterName: hole.item.characterName,
          records: hole.guideRecords,
          thumbnailSrc: preview?.thumbnailSrc ?? null,
        };
      });
    }, [
      loadedImagesCount,
      playerContentSceneMarkers,
      playerStore.content,
      serverEpisodeHolesWithContentMeta,
      toonWork,
      version,
    ]);

    const handleSceneNavigate = useCallback(
      (startMs: number, options?: { alignToRecordingThumbnail?: boolean; holeUuid?: string }) => {
        if (isPlaying) {
          handleControl(PlayerControlType.pause);
        }

        const applyScroll = () => {
          const playbackMarkers = toonWork.getMarkers?.() ?? [];
          const contentSceneMarkers = getPlaybackContentSceneMarkers(usePlayerStore.getState().content);
          const currentMarkers = resolveTimelineSceneMarkers(playbackMarkers, contentSceneMarkers);

          if (currentMarkers.length === 0) {
            playerLogger.warn(
              "[PlayerContent] handleSceneNavigate: scene marker가 없어 이동할 수 없습니다.",
            );
            return;
          }

          let contentList = toonWork.getToonContentImageList();
          if (!contentList) {
            const el = document.querySelector(".toon-scroll-layer");
            contentList = el instanceof HTMLElement ? el : null;
          }

          if (!contentList) {
            playerLogger.warn(
              "[PlayerContent] handleSceneNavigate: 스크롤 컨테이너를 찾을 수 없습니다.",
            );
            return;
          }

          if (options?.alignToRecordingThumbnail) {
            const directImage = (() => {
              if (!options.holeUuid) {
                return null;
              }
              const requestedKeys = new Set(uuidAliasKeys(options.holeUuid));
              const matched = serverEpisodeHolesWithContentMeta.find((hole) => {
                const keys = [
                  ...uuidAliasKeys(hole.contentHoleUuid),
                  ...uuidAliasKeys(hole.item.uuid),
                ];
                return keys.some((key) => requestedKeys.has(key));
              });
              return matched?.directImage ?? null;
            })();
            const preview = resolveRecordingPreviewForScene({
              startMs,
              sceneMarkers: contentSceneMarkers,
              images: getPlaybackContentImages(usePlayerStore.getState().content),
              version,
              contentList,
              markers: currentMarkers,
              workspaceImageScale: toonWork.workspaceOptions?.image_scale ?? 1,
              viewOffsetTop: toonWork.newViewOffsetTop(),
              calculatedWidth: toonWork.calculatedWidth,
              directImage,
            });

            if (preview?.scrollTop !== null && preview?.scrollTop !== undefined) {
              toonWork.setToonContentImageTop(preview.scrollTop);
              return;
            }
          }

          const targetScrollTop = resolveSceneNavigateTargetScrollTop({
            startMs,
            sceneMarkers: contentSceneMarkers,
            version,
            contentList,
            markers: currentMarkers,
            workspaceImageScale: toonWork.workspaceOptions?.image_scale ?? 1,
            viewOffsetTop: toonWork.newViewOffsetTop(),
            calculatedWidth: toonWork.calculatedWidth,
          });

          if (targetScrollTop === null) {
            playerLogger.warn(
              "[PlayerContent] handleSceneNavigate: 목표 스크롤 위치를 계산하지 못했습니다.",
            );
            return;
          }

          toonWork.setToonContentImageTop(targetScrollTop);
        };

        requestAnimationFrame(() => {
          requestAnimationFrame(applyScroll);
        });
      },
      [toonWork, version, isPlaying, handleControl, serverEpisodeHolesWithContentMeta],
    );

    const immersivePeekBottomOffset = useMemo(
      () =>
        getPlayerImmersivePeekBottomOffset({
          isDesktop: toonWork.calculatedWidthCustom > 768,
          hasRecordingStrip: false,
          isEpisodeListOpen,
        }),
      [
        toonWork.calculatedWidthCustom,
        isEpisodeListOpen,
      ],
    );

    const handleDialogSceneNavigate = useCallback(
      (startMs: number) => {
        handleSceneNavigate(startMs, { alignToRecordingThumbnail: true });
      },
      [handleSceneNavigate],
    );

    // 서버 녹음 메타를 hole.uuid 기준으로 매핑 (API 실패 시 빈 맵)
    useEffect(() => {
      const content = usePlayerStore.getState().content;
      if (collectHolesFromContent(content).length === 0) {
        setServerEpisodeHoles([]);
        useRecordingStore.getState().setServerRecordings({}, {});
        return;
      }

      if (!resolvedRecordingEpisodeId) {
        setServerEpisodeHoles([]);
        useRecordingStore.getState().setServerRecordings({}, {});
        return;
      }

      let cancelled = false;
      setServerEpisodeHoles([]);
      useRecordingStore.getState().setServerRecordings({}, {});

      void (async () => {
        try {
          const holes = collectHolesFromContent(content);
          const res = await fetchEpisodeRecordings(resolvedRecordingEpisodeId, {
            useTrialsPublicApi: trialEphemeralRecording,
          });
          if (cancelled) return;
          const apiHoleRows = res.data?.items ?? [];
          setServerEpisodeHoles(apiHoleRows);
          const { recordingsByHoleUuid, serverHoleIdByHoleUuid } =
            buildServerRecordingMapsByHoleUuid(holes, apiHoleRows);
          useRecordingStore
            .getState()
            .setServerRecordings(recordingsByHoleUuid, serverHoleIdByHoleUuid);

          const storeState = useRecordingStore.getState();
          storeState.setUseUserRecording(false);
        } catch (e) {
          playerLogger.warn("[PlayerContent] 에피소드 녹음 목록 로드 실패:", e);
          if (!cancelled) {
            setServerEpisodeHoles([]);
            useRecordingStore.getState().setServerRecordings({}, {});
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [resolvedRecordingEpisodeId, playerContentIdentityKey, holesFetchVersion, trialEphemeralRecording]);

    const handleEpisodeFromList = useCallback(
      (item: PlayerEpisodeListItem) => {
        if (userHasLoan === false && !canBypassLoanGateInTrialMode) {
          showSnackBar("대출 이후 열람이 가능합니다.");
          return;
        }
        setEpisodeListOpen(false);
        const nav = usePlayerStore.getState().playerSeriesEpisodeNav;
        const sid = nav?.seriesId ?? seriesId;
        if (sid > 0 && Number.isFinite(item.id)) {
          router.push(
            `/player/${currentPlayerKey}?seriesId=${sid}&episodeId=${item.id}`,
          );
        }
      },
      [
        userHasLoan,
        canBypassLoanGateInTrialMode,
        showSnackBar,
        router,
        setEpisodeListOpen,
        currentPlayerKey,
        seriesId,
      ],
    );

    const handleEpisodeListButtonClick = useCallback(async () => {
      if (userHasLoan === false && !canBypassLoanGateInTrialMode) {
        showSnackBar("대출 이후 열람이 가능합니다.");
        return;
      }

      await handleControlGuarded(PlayerControlType.list);
    }, [userHasLoan, canBypassLoanGateInTrialMode, showSnackBar, handleControlGuarded]);

    /**
     * 적용하기 직후: 기존 ShockWave가 오리지널로 남아 있으면 재생이 갱신되지 않으므로 먼저 보이스를 다시 로드한다.
     * 이후 GET /holes 재조회로 serverRecordings·슬롯 UI를 맞춘다.
     */
    const handleRecordingSaved = useCallback(async () => {
      await toonWork.changeVoice();
      refetchServerRecordings();
    }, [toonWork, refetchServerRecordings]);

    /* 최종 메시지는 isInitializing 등으로 isLoading이 true로 남아도 표시 (오프라인 장시간 대기 방지) */
    const showLoadFailedOverlay = isInitLoadFinalOverlayMessage(loadingErrorMessage);

    const loadFailedOverlayEl = showLoadFailedOverlay ? (
      <div
        className="fixed inset-0 z-[10000] box-border flex min-h-[100dvh] w-screen flex-col items-center justify-center gap-4 bg-[rgba(10,11,14,0.55)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] text-center text-white backdrop-blur-[2px]"
        role="alert"
      >
        <p className="max-w-[420px] text-base leading-snug">{loadingErrorMessage}</p>
        <button
          type="button"
          className="h-10 min-w-[120px] rounded-lg border border-white/50 bg-white/12 text-sm font-semibold text-white"
          onClick={handleManualRetry}
        >
          다시 시도
        </button>
      </div>
    ) : null;

    return (
      <>
        {/*프리로드 + 초기화 통합 로딩 오버레이*/}
        {loadingState.shouldShowLoadingOverlay ? (
          <PlayerLoadingbar
            loading={true}
            progress={getLoadingProgress()}
            message={getLoadingMessage()}
            fullscreen={true}
            zIndex={9999}
          />
        ) : null}
        <div className="viewer-layout">
          {!playerStore.loading && (
            <div
              className={clsx(
                "viewer-header",
                immersiveChromeHidden && "is-chrome-hidden",
              )}
            >
              <PlayerHeader
                backHref={backHref}
                title={headerTitle}
                subtitle={headerSubtitle}
                showExperienceEntry={showExperienceEntry}
              />
            </div>
          )}
          <PlayerViewer
            toonBoxRef={toonBoxRef}
            clearTextToonBoxRef={clearTextToonBoxRef}
            baseToonWorkRef={baseToonWorkRef}
            clearTextBaseToonWorkRef={clearTextBaseToonWorkRef}
            overlayRef={overlayRef}
            handleNormalScroll={handleNormalScroll}
            handleClearTextScroll={handleClearTextScroll}
            isClearText={isClearText}
            isPlaying={isPlaying}
            showContent={showContent}
            version={version}
            seriesId={seriesId}
            episodeId={episodeId}
            playerInfo={playerStore.content ? { content: playerStore.content, episode: null, clearTextImages: [] } : null}
            imageCache={getImageMemoryCache()}
            calculatedWidth={toonWork.calculatedWidth}
            workspaceOptions={toonWork.workspaceOptions}
            isStop={toonWork.isStop}
            getImageUrl={getImageUrl}
            getImageKey={getImageKey}
            handleImageLoad={handleImageLoad}
            handleClearTextImageLoad={handleClearTextImageLoad}
            playbackTimeMs={playbackTimeMs}
            onImmersiveTap={handleImmersiveTap}
          />
          {immersiveChromeHidden ? (
            <PlayerImmersivePeekOverlay
              visible={immersivePeekVisible}
              isMuted={isMuted}
              calculatedWidthCustom={toonWork.calculatedWidthCustom}
              bottomOffset={immersivePeekBottomOffset}
              onPause={handleImmersivePause}
              onMuteToggle={handleImmersiveMute}
            />
          ) : null}
        </div>
        {typeof document !== "undefined" && loadFailedOverlayEl
          ? createPortal(loadFailedOverlayEl, document.body)
          : null}
        <PlayerControls
          isPlaying={isPlaying}
          isMuted={isMuted}
          playerStoreLoading={playerStore.loading}
          calculatedWidthCustom={toonWork.calculatedWidthCustom}
          currentEpisodeId={resolvedRecordingEpisodeId}
          recordingMarkers={[]}
          onEpisodeSelect={handleEpisodeFromList}
          handlePlayClick={handlePlayClick}
          handleControl={handleControlGuarded}
          playbackReadiness={playbackReadiness}
          runtimeLoadingCount={toonWork.loadingCount}
          runtimeIsInitializing={toonWork.isInitializing}
          chromeHidden={immersiveChromeHidden}
          onListButtonClick={handleEpisodeListButtonClick}
        />
        <RecordingIntegratedDialog
          episodeId={resolvedRecordingEpisodeId}
          holes={recordingDialogHoles}
          onNavigateToScene={handleDialogSceneNavigate}
          onRecordingSaved={handleRecordingSaved}
          trialEphemeralPlayback={trialEphemeralRecording}
        />
        <style jsx>{`
          .viewer-layout {
            height: 100svh;
            min-height: 100svh;
            width: 100%;
            max-width: ${toonWork.calculatedWidth}px;
            margin: 0 auto;
            background: #ffffff;
            position: relative;
            overflow: hidden;
          }

          .viewer-header {
            position: fixed;
            top: 0;
            left: 50%;
            transform: translate(-50%, 0);
            z-index: 1000;
            width: 100%;
            max-width: 1280px;
            transition:
              transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.35s ease;
          }

          .viewer-header.is-chrome-hidden {
            transform: translate(-50%, calc(-100% - 8px));
            opacity: 0;
            pointer-events: none;
          }

          @media (max-width: 768px) {
            .viewer-header {
              margin: 0 auto;
            }
          }

          @media (min-width: 769px) {
            .viewer-header {
              left: 0;
              right: 0;
              max-width: none;
              width: 100%;
              transform: none;
            }

            .viewer-header.is-chrome-hidden {
              transform: translateY(calc(-100% - 8px));
            }
          }
        `}</style>
      </>
    );
  }
);

PlayerContent.displayName = "PlayerContent";

export default PlayerContent;
