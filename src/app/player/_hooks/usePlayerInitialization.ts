/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useLayoutEffect, useRef } from "react";
import { playerLogger } from "@/app/player/_lib/playerLogger";
import {
  getPlaybackContentImages,
  getPlaybackContentManifest,
} from "@/lib/playbackContentAccess";
import { getPlaybackAudioResourceRequests } from "@/lib/playbackV2/runtime";
import { usePlayerStore } from "@/stores/usePlayerStore";

interface UsePlayerInitializationParams {
  seriesId: number;
  episodeId: number;

  // Refs
  prevSeriesIdRef: React.MutableRefObject<number | null>;
  prevEpisodeIdRef: React.MutableRefObject<number | null>;
  dataLoadRequestedRef: React.MutableRefObject<boolean>;
  /** stop/cleanup/initializeVoiceToon — toonWork 객체는 매 렌더 새 참조라 effect deps에 넣지 않고 ref만 사용 */
  toonWorkCleanupRef: React.MutableRefObject<any>;
  totalImagesRef: React.MutableRefObject<number>;
  totalClearTextImagesRef: React.MutableRefObject<number>;
  autoPlayAttemptedRef: React.MutableRefObject<boolean>;

  // State setters
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadedImagesCount: React.Dispatch<React.SetStateAction<number>>;
  setLoadedClearTextImagesCount: React.Dispatch<React.SetStateAction<number>>;
  setShowContent: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPreloading: React.Dispatch<React.SetStateAction<boolean>>;
  setPreloadProgress: React.Dispatch<React.SetStateAction<{ step: string; percentage: number }>>;

  /** `playerStore.content` 객체 참조가 아닌 논리적 동일성 키 (스토어 부분 갱신 시 무한 effect/cleanup 방지) */
  playerContentIdentityKey: string;

  /** 같은 에피소드에서도 강제 재초기화가 필요할 때 증가시키는 시드 */
  retrySeed?: number;
  /** 초기화 실패(예외/타임아웃) 알림 */
  onInitializationError?: (error: unknown) => void;
}

/**
 * 플레이어 초기화 Hook
 *
 * 티켓 기반 데이터 로드 및 toonWork 초기화를 담당
 */
export function usePlayerInitialization(params: UsePlayerInitializationParams) {
  const {
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
    retrySeed = 0,
    onInitializationError,
  } = params;

  const onInitializationErrorRef = useRef(onInitializationError);
  useLayoutEffect(() => {
    onInitializationErrorRef.current = onInitializationError;
  }, [onInitializationError]);

  // 마지막으로 완료한 초기화 키 (episodeId + 콘텐츠 지문 — 참조 변경만으로는 초기화 반복하지 않음)
  const lastInitializedContentKeyRef = useRef<string>("");

  // 브라우저 뒤로가기/앞으로가기 감지 및 강제 리로드
  useEffect(() => {
    const handlePopState = () => {
      playerLogger.log("[PlayerContent] popstate 이벤트 감지 - 브라우저 뒤로/앞으로 가기", {
        currentUrl: window.location.pathname,
        currentSeriesId: seriesId,
        currentEpisodeId: episodeId,
        prevSeriesId: prevSeriesIdRef.current,
        prevEpisodeId: prevEpisodeIdRef.current,
      });

      // 브라우저 뒤로가기 시 모든 상태 강제 리셋
      dataLoadRequestedRef.current = false;
      prevSeriesIdRef.current = null;
      prevEpisodeIdRef.current = null;
      lastInitializedContentKeyRef.current = ""; // 초기화 기록 리셋

      // 이미지 카운트 리셋
      setLoadedImagesCount(0);
      setLoadedClearTextImagesCount(0);
      totalImagesRef.current = 0;
      totalClearTextImagesRef.current = 0;

      // 재생 상태 리셋
      setIsPlaying(false);
      setIsPaused(false);
      autoPlayAttemptedRef.current = false; // 자동 재생 플래그 리셋

      // ToonWork 중지 — stop만으로는 ShockWave/Tone 리소스가 남아 소리가 이어질 수 있어 cleanup까지 수행
      const tw = toonWorkCleanupRef.current;
      if (tw) {
        void (async () => {
          try {
            if (!tw.isStop) {
              await tw.stop();
            }
            await tw.cleanup();
          } catch (e: unknown) {
            playerLogger.error("[PlayerContent] popstate stop/cleanup 실패:", e);
          }
        })();
      }

      playerLogger.log("[PlayerContent] popstate 리셋 완료");
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    autoPlayAttemptedRef,
    dataLoadRequestedRef,
    seriesId,
    episodeId,
    prevEpisodeIdRef,
    prevSeriesIdRef,
    setIsPaused,
    setIsPlaying,
    setLoadedClearTextImagesCount,
    setLoadedImagesCount,
    totalClearTextImagesRef,
    totalImagesRef,
    toonWorkCleanupRef,
  ]);

  // vogopang: content가 설정되면 로드 완료로 간주 (페이지에서 loadVogopangContent 호출함)
  useEffect(() => {
    if (!playerContentIdentityKey) return;
    if (prevSeriesIdRef.current === seriesId && prevEpisodeIdRef.current === episodeId) return;
    dataLoadRequestedRef.current = false;
    lastInitializedContentKeyRef.current = "";
    prevSeriesIdRef.current = seriesId;
    prevEpisodeIdRef.current = episodeId;
    dataLoadRequestedRef.current = true;
    setIsPlaying(false);
    setIsPaused(false);
    setShowContent(false);
    setLoadedImagesCount(0);
    setLoadedClearTextImagesCount(0);
    totalImagesRef.current = 0;
    totalClearTextImagesRef.current = 0;
    autoPlayAttemptedRef.current = false;
    if (!toonWorkCleanupRef.current.isStop) {
      toonWorkCleanupRef.current.stop().catch((e: unknown) => playerLogger.error("[PlayerContent] stop 실패:", e));
    }
  }, [
    autoPlayAttemptedRef,
    dataLoadRequestedRef,
    episodeId,
    playerContentIdentityKey,
    prevEpisodeIdRef,
    prevSeriesIdRef,
    seriesId,
    setIsPaused,
    setIsPlaying,
    setLoadedClearTextImagesCount,
    setLoadedImagesCount,
    setShowContent,
    toonWorkCleanupRef,
    totalClearTextImagesRef,
    totalImagesRef,
  ]);

  // Initialize toonWork with content (vogopang: content만 사용)
  useEffect(() => {
    const playerStoreState = usePlayerStore.getState();
    const content = playerStoreState.content as any;
    if (getPlaybackContentImages(content).length === 0) return;
    if (!playerContentIdentityKey) return;
    const initKey = `${episodeId}|${playerContentIdentityKey}|${retrySeed}`;
    if (lastInitializedContentKeyRef.current === initKey) return;

    lastInitializedContentKeyRef.current = initKey;
    playerLogger.log("[PlayerContent] 초기화 시작 - content 기반");

    /** retrySeed 교체·언마운트 후 이전 비동기 catch가 onInitializationError를 호출하지 않도록 */
    let initCancelled = false;
    /** Strict Mode: 첫 effect cleanup 후에도 ref가 initKey로 남으면 두 번째 effect가 즉시 return 해 초기화가 영원히 스킵됨 → cleanup 시 되돌림 */
    const initKeyClaimedForThisEffect = initKey;

    const initializeWithCleanup = async () => {
      if (!toonWorkCleanupRef.current.isStop) {
        toonWorkCleanupRef.current.stop().catch((e: unknown) => playerLogger.error("[PlayerContent] 백그라운드 stop 실패:", e));
      }
      toonWorkCleanupRef.current.cleanup().catch((e: unknown) => playerLogger.error("[PlayerContent] 백그라운드 cleanup 실패:", e));

      setIsPlaying(false);
      setIsPaused(false);
      setLoadedImagesCount(0);
      setLoadedClearTextImagesCount(0);
      totalImagesRef.current = 0;
      totalClearTextImagesRef.current = 0;
      autoPlayAttemptedRef.current = false;

      const audioUrls: string[] = [];
      const imageUrls: string[] = [];
      const clearTextImageUrls: string[] = [];
      const imageList = getPlaybackContentImages(content);
      const clearTextImages: unknown[] = [];

        for (const image of imageList) {
          const url = (image as { url?: string; rawSrc?: string; src?: string }).url || (image as { url?: string; rawSrc?: string; src?: string }).rawSrc || (image as { url?: string; rawSrc?: string; src?: string }).src;
          if (url) imageUrls.push(url);
        }

        for (const image of clearTextImages) {
          const url = (image as { url?: string; rawSrc?: string; src?: string }).url || (image as { url?: string; rawSrc?: string; src?: string }).rawSrc || (image as { url?: string; rawSrc?: string; src?: string }).src;
          if (url) clearTextImageUrls.push(url);
        }

        // 오디오 트랙 URL 추출
        const uniqueAudioUrlSet = new Set<string>();
        const pushAudioUrl = (url?: string | null) => {
          if (!url) return;
          if (uniqueAudioUrlSet.has(url)) return;
          uniqueAudioUrlSet.add(url);
          audioUrls.push(url);
        };

        const playbackManifest = getPlaybackContentManifest(content);
        if (playbackManifest) {
          for (const request of getPlaybackAudioResourceRequests(playbackManifest)) {
            pushAudioUrl(request.src);
          }
        }

        if (content.audio_tracks) {
          for (const track of content.audio_tracks) {
            const clips = track.clips ?? [];
            for (const clip of clips) {
              const url = clip.url || clip.rawSrc || clip.src;
              pushAudioUrl(url);
            }
          }
        }

        // 보이스 트랙 URL 추출
        if (content.tracks) {
          for (const track of content.tracks) {
            const holes = track.holes ?? [];
            for (const hole of holes) {
              const records = hole.records ?? [];
              for (const record of records) {
                const url = record.url || record.rawSrc || record.src;
                pushAudioUrl(url);
              }
            }
          }
        }

        playerLogger.log("[PlayerContent] 스마트 캐시 정리 시작");
        // const [removedImages, removedAudios] = await Promise.all([
        //   playerStore.clearUnusedImages(allImageUrls),
        //   playerStore.clearUnusedAudios(allAudioUrls),
        // ]);
        // playerLogger.log(`[PlayerContent] 스마트 캐시 정리 완료 - 이미지 ${removedImages}개, 오디오 ${removedAudios}개 제거`);

        // 이미지와 오디오/보이스 병렬 프리로드
        const totalPreloadCount = imageUrls.length + audioUrls.length;

        // 프리로드 시작 상태 설정 (진행률은 initializeVoiceToon에서 통합 관리)
        if (totalPreloadCount > 0) {
          setIsPreloading(true);
          setPreloadProgress({
            step: '이미지 다운로드 중...',
            percentage: 0,
          });
        }

        // 이미지/오디오를 동시에 시작
        const imagePromise = imageUrls.length > 0
          ? playerStoreState.preloadImages(imageUrls)
          : Promise.resolve([]);

        const audioPromise = audioUrls.length > 0
          ? playerStoreState.preloadAudios(audioUrls)
          : Promise.resolve([]);

        const [imageResults, audioResults] = await Promise.all([imagePromise, audioPromise]);
        if (initCancelled) return;

        const imageFailedCount = imageResults.filter((result) => !result).length;
        const audioFailedCount = audioResults.filter((result) => !result).length;

        if (imageUrls.length > 0) {
          playerLogger.log(
            `[PlayerContent] 이미지 프리로드 시작: ${imageUrls.length}개`
          );
        }
        if (audioUrls.length > 0) {
          playerLogger.log(
            `[PlayerContent] 오디오/보이스 프리로드 완료: ${audioUrls.length - audioFailedCount}/${audioUrls.length}개`
          );
        }

        if (imageFailedCount > 0 || audioFailedCount > 0) {
          throw new Error(
            `필수 리소스 로딩 실패 (image: ${imageFailedCount}/${imageUrls.length}, audio: ${audioFailedCount}/${audioUrls.length})`,
          );
        }

        if (initCancelled) return;

        // 이미지/컷이 없어도 플레이어 UI는 표시
        setShowContent(true);

        // 이미지 프리로드 완료 후 바로 다음 단계 진행
        setIsPreloading(false);

        // 4. vogopang: 캐스팅 없음. data 형태로 { content, episode, directions, clearTextImages } 전달
        const data = {
          content: playerStoreState.content as any,
          episode: null,
          directions: [] as unknown[],
          clearTextImages: [] as unknown[],
        };
        await toonWorkCleanupRef.current.initializeVoiceToon(data, []);
        if (initCancelled) return;

        const images = (playerStoreState.content as any)?.images ?? [];
        const clearImages: unknown[] = [];
        totalImagesRef.current = images.length;
        totalClearTextImagesRef.current = clearImages.length;

        playerLogger.log(
          `[PlayerContent] 초기화 완료 - 에피소드 ${episodeId}`
        );
      };

      initializeWithCleanup().catch((error) => {
        if (initCancelled) {
          playerLogger.log(
            "[PlayerContent] 초기화 오류 무시 (취소된 시도 — 재시도/이탈로 무효화)",
          );
          return;
        }
        playerLogger.error("[PlayerContent] 초기화 중 오류:", error);
        setIsPreloading(false);
        setPreloadProgress({
          step: "콘텐츠 로딩에 실패했습니다.",
          percentage: 0,
        });
        onInitializationErrorRef.current?.(error);
      });

    const currentToonWork = toonWorkCleanupRef.current;
    return () => {
      initCancelled = true;
      if (lastInitializedContentKeyRef.current === initKeyClaimedForThisEffect) {
        lastInitializedContentKeyRef.current = "";
      }
      if (currentToonWork) {
        if (!currentToonWork.isStop) {
          currentToonWork.stop().catch((e: unknown) => playerLogger.error("[PlayerContent] stop 중 오류:", e));
        }
        currentToonWork.cleanup().catch((e: unknown) => playerLogger.error("[PlayerContent] cleanup 중 오류:", e));
      }
    };
  }, [
    autoPlayAttemptedRef,
    episodeId,
    playerContentIdentityKey,
    setIsPaused,
    setIsPlaying,
    setIsPreloading,
    setLoadedClearTextImagesCount,
    setLoadedImagesCount,
    setPreloadProgress,
    setShowContent,
    retrySeed,
    toonWorkCleanupRef,
    totalClearTextImagesRef,
    totalImagesRef,
  ]);
}
