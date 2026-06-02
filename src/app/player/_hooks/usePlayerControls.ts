/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlayerControlType } from "@/app/player/types";
import { playerLogger } from "@/app/player/_lib/playerLogger";
import { resolvePlayerPlaybackReadiness } from "@/app/player/_lib/playerPlaybackReadiness";

interface UsePlayerControlsParams {
  /** 이전/다음 화 네비용 현재 URL playerKey */
  currentPlayerKey: string;
  currentEpisodeId: number;
  // ToonWork
  toonWork: any;
  toonWorkCleanupRef: React.MutableRefObject<any>;

  // Player Store
  playerStore: any;

  // State setters
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;

  // State values
  loadedImagesCount: number;

  // Refs
  totalImagesRef: React.MutableRefObject<number>;

}

/**
 * 플레이어 컨트롤 Hook
 *
 * 재생/일시정지/정지 등 플레이어 컨트롤 핸들러들을 담당
 */
export function usePlayerControls(params: UsePlayerControlsParams) {
  const {
    currentPlayerKey,
    currentEpisodeId,
    toonWork,
    toonWorkCleanupRef,
    playerStore,
    setIsPlaying,
    setIsPaused,
    loadedImagesCount,
    totalImagesRef,
  } = params;

  const router = useRouter();

  // 재생 완료 핸들러
  const handlePlaybackComplete = useCallback(async () => {
    playerLogger.log("[PlayerContent] Playback complete");

    // sessionStorage에서 직접 읽기
    const isAutoPlay = sessionStorage.getItem("isAutoPlay") === "true";
    const isInitAutoPlay = sessionStorage.getItem("isInitAutoPlay") === "true";

    playerLogger.log("[PlayerContent] 정주행 모드 상태:", {
      isAutoPlay,
      isInitAutoPlay,
    });

    // vogopang: 단일 콘텐츠라 다음 회차 없음
    if (isAutoPlay) {
      playerLogger.log("[PlayerContent] 재생 완료 (vogopang 단일 콘텐츠)");
    }
  }, []);

  // 재생 중지 핸들러
  const handleStop = useCallback(async () => {
    playerLogger.log("[PlayerContent] handleStop 호출됨");

    // 1. 재생 중지 — stop 완료 후 cleanup 해야 Tone/오디오 레이스가 나지 않음
    playerLogger.log("[PlayerContent] 재생 중지 - stop 호출");
    if (!toonWork.isStop) {
      await toonWork.stop();
    }
    const refTw = toonWorkCleanupRef.current;
    if (refTw && !refTw.isStop) {
      await refTw.stop();
    }

    // 2. 완전 정리 (비동기)
    playerLogger.log("[PlayerContent] cleanup 호출");
    await refTw.cleanup();
    playerLogger.log("[PlayerContent] cleanup 완료");

    // 4. 상태 초기화
    setIsPlaying(false);
    setIsPaused(false);
  }, [
    toonWork,
    toonWorkCleanupRef,
    setIsPlaying,
    setIsPaused,
  ]);

  // 컨트롤 핸들러
  const handleControl = useCallback(
    async (type: PlayerControlType, options: any = {}) => {
      await playerStore.handleControl(
        type,
        {
          toonWork,
          router,
          currentPlayerKey,
          currentEpisodeId,
          setState: {
            setIsPlaying,
            setIsPaused,
          },
        },
        options
      );
    },
    [toonWork, playerStore, router, currentPlayerKey, currentEpisodeId, setIsPlaying, setIsPaused]
  );

  // 재생 버튼 클릭 핸들러 (리소스 준비 상태 확인)
  const handlePlayClick = useCallback((options: any = {}) => {
    // 리소스 준비 상태 확인
    const readiness = resolvePlayerPlaybackReadiness({
      isInitializing: toonWork.isInitializing,
      resourceLoadingCount: toonWork.loadingCount,
      playerStoreLoading: playerStore.loading,
    });

      playerLogger.log("[PlayerContent] 재생 버튼 클릭 - 리소스 체크:", {
        initializationComplete: !toonWork.isInitializing,
        allResourcesLoaded: toonWork.loadingCount === 0,
        loadedImagesRendered: `${loadedImagesCount}/${totalImagesRef.current}`,
        playerStoreLoading: playerStore.loading,
        isReady: readiness.isReady,
        blockedReason: readiness.reason,
      });

    if (readiness.isReady) {
      // 리소스가 준비되었으면 바로 재생
      playerLogger.log("[PlayerContent] 리소스 준비 완료 - 재생 시작");
      handleControl(PlayerControlType.play, options);
    } else {
      // 리소스가 준비되지 않았으면 알림 표시 및 재생 대기
      playerLogger.log("[PlayerContent] 리소스 준비 중 - 재생 대기, 알림 표시");
    }
  }, [
    toonWork.isInitializing,
    toonWork.loadingCount,
    loadedImagesCount,
    playerStore.loading,
    handleControl,
    totalImagesRef,
  ]);

  return {
    handlePlaybackComplete,
    handleStop,
    handleControl,
    handlePlayClick,
  };
}
