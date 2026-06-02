/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { decode } from "@msgpack/msgpack";
import type {
  PlayerRuntimeContent,
  VogopangContent,
} from "@/data/vogopangContentTypes";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PLAYER_LIB_LOAD_BLOCKED_USER_MESSAGE } from "@/app/player/_lib/playerLibLoadMessages";
import { useErrorDialogStore } from "@/stores/useErrorDialogStore";
import { useGlobalSnackBarStore } from "@/stores/useGlobalSnackBarStore";
import { PlayerControlType } from "@/app/player/types";
import { notify } from "@/lib/notify";
import { playerLogger } from "@/app/player/_lib/playerLogger";
import { flutterIsApp, flutterDownloadFiles } from "@/lib/flutterBridge";
import {
  LIB_MEDIA_BASE,
  getMediaUrl,
  getFetchUrl,
  getLibMediaUrl,
  getPublicApiBaseUrl,
  isLibMediaPath,
  type MediaUrlType,
} from "@/lib/environment";
import { apiClient } from "@/api/client";
import { postTrialPlayerInfo } from "@/api/trialsPublic";
import { getLibraryServiceTypeSessionHint } from "@/lib/libraryServiceTypeSession";
import { DEFAULT_PLAYER_API_KEY_MAP, resolvePlayerBackendIds } from "@/lib/playerBackendIds";
import { isAllowedPlayerKey, normalizeBackendPayload } from "@/lib/playerContentNormalize";
import {
  getPlaybackContentImages,
  hasPlayableContentImages,
} from "@/lib/playbackContentAccess";
import { extractSeriesEpisodeNavFromPlayerInfoPayload } from "@/lib/playerInfoEpisodes";
import type { PlayerEpisodeListItem } from "@/app/player/playerEpisodeListData";
import type { LibraryServiceType } from "@/types/libraryServiceMode";
import { getLocalPlayerJsonPath } from "@/lib/localPlayerContent";
import { waitForAudioContextRunning } from "@/app/player/_lib/audioContextReadiness";
import {
  resolvePlaybackAudioStartPolicy,
  type PlaybackAudioMode,
} from "@/app/player/_lib/playerPlaybackReadiness";

// ===== Module-level Cache (Zustand 상태 업데이트를 피하기 위한 전역 캐시) =====
// 이 Map들은 Zustand store 외부에 존재하여 상태 업데이트로 인한 사이드 이펙트를 방지합니다.
const imageMemoryCache = new Map<string, string>(); // URL -> blob URL
const imageMemoryCacheSize = new Map<string, number | null>(); // URL -> fetched blob size
const audioMemoryCache = new Map<string, string>(); // URL -> blob URL
const pendingImageDownloads = new Map<string, Promise<string | null>>(); // 중복 다운로드 방지
const pendingAudioDownloads = new Map<string, Promise<string | null>>(); // 중복 다운로드 방지

/**
 * 오프라인일 때만 프리로드 루프의 재시도·백오프를 생략한다.
 * 온라인에서의 `Failed to fetch`(DevTools 차단, CORS, 일시 장애 등)는 기존 maxRetries까지 재시도한다.
 * (과거에는 Failed to fetch까지 즉시 실패 처리해 B-1처럼 온라인+차단 시 재시도가 한 번도 안 돌았음.)
 */
function shouldSkipMediaDownloadRetries(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

// 모듈 레벨 캐시 접근 함수 (외부에서 사용)
export const getImageMemoryCache = () => imageMemoryCache;
export const getImageMemoryCacheSize = () => imageMemoryCacheSize;
export const getAudioMemoryCache = () => audioMemoryCache;

// ===== Type Definitions =====
export interface ToonWorkDependency {
  isStop: boolean
  setSelectArtistNos: (nos: number[]) => void
  changeVoice: () => Promise<void>
  play: (options?: number | { startMs?: number; audioMode?: PlaybackAudioMode }) => void
}

export interface PlayerControlDependencies {
  toonWork: ToonWorkDependency & {
    stop: () => void
    toggleMute: (value: boolean) => void
  }
  router: AppRouterInstance
  /** URL 경로 세그먼트 — 백엔드 모드에서도 쿼리만 바꿀 때 동일 키 유지 */
  currentPlayerKey: string
  /** 현재 재생 중인 회차 id (쿼리 또는 헤더 메타) */
  currentEpisodeId: number
  setState: {
    setIsPlaying: (value: boolean) => void
    setIsPaused: (value: boolean) => void
  }
}

// ===== Player State Interface (vogopang: 캐스팅/티켓/에피소드 없음) =====
export interface PlayerState {
  content: PlayerRuntimeContent | null;

  isMuted: boolean;
  isClearText: boolean;
  isOpenAutoPlayDialog: boolean;
  /** 목록 버튼으로 토글되는 에피소드 가로 목록 패널 */
  isEpisodeListOpen: boolean;
  setEpisodeListOpen: (open: boolean) => void;
  /** `POST /player/info` 응답의 `episodes` — 있으면 목록·이전/다음 화에 사용 */
  playerSeriesEpisodeNav: { seriesId: number; items: PlayerEpisodeListItem[] } | null;

  isPlaying: boolean;
  isPaused: boolean;
  isPlayTransitioning: boolean;

  loading: boolean;
  isImageTransitioning: boolean;
  error: string | null;
  imageCache: Map<string, string>;
  imageLoadingStatus: Map<string, "loading" | "loaded" | "error">;
  pendingDownloads: Map<string, Promise<string | null>>;
  audioCache: Map<string, string>;
  audioPendingDownloads: Map<string, Promise<string | null>>;

  setLoading: (value: boolean) => void;
  clearError: () => void;
  cleanup: () => Promise<void>;
  loadVogopangContent: (site?: "kids" | "edu" | "senior" | "lib") => Promise<boolean>;
  loadVogopangContentByUuid: (site: "kids" | "edu" | "senior", playerUuid: string) => Promise<boolean>;
  loadLibContentByPlayerKey: (
    playerKey: string,
    options?: {
      seriesId?: number | null;
      episodeId?: number | null;
      source?: "local" | "backend" | "auto";
      serviceType?: LibraryServiceType;
    }
  ) => Promise<boolean>;
  downloadImage: (imageUrl: string) => Promise<string | null>;
  preloadImages: (imageUrls: string[]) => Promise<(string | null)[]>;
  resetImageLoadingStatus: () => void;
  clearImages: () => Promise<void>;
  clearUnusedImages: (keepUrls: Set<string>) => Promise<number>;
  downloadAudio: (audioUrl: string, type?: MediaUrlType) => Promise<string | null>;
  preloadAudios: (audioUrls: string[]) => Promise<(string | null)[]>;
  clearAudios: () => Promise<void>;
  getCachedAudioUrl: (originalUrl: string) => string | null;

  hasV2: () => boolean;
  hasV0: () => boolean;
  getVersion: () => string;
  openAutoPlayDialog: () => void;
  closeAutoPlayDialog: () => void;

  handleControl: (type: PlayerControlType, dependencies: PlayerControlDependencies, options?: { startMs?: number }) => Promise<void>;
  resetPlayerData: () => void;
}

// ===== Zustand Store =====
export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => {
      return {
        content: null,

        isMuted: false,
        isClearText: false,
        isOpenAutoPlayDialog: false,
        isEpisodeListOpen: false,
        setEpisodeListOpen: (open) => set({ isEpisodeListOpen: open }),
        playerSeriesEpisodeNav: null,

        isPlaying: false,
        isPaused: false,
        isPlayTransitioning: false,

        loading: false,
        isImageTransitioning: false,
        error: null,
        imageCache: new Map(),
        imageLoadingStatus: new Map(),
        pendingDownloads: new Map(),
        audioCache: new Map(),
        audioPendingDownloads: new Map(),

      // 로딩 상태 설정
      setLoading: (value: boolean) => {
        set({ loading: value });
      },

      // 에러 초기화
      clearError: () => set({ error: null }),

      cleanup: async () => {
        try {
          const Tone = await import('tone');
          Tone.getTransport().stop();
          Tone.getTransport().cancel();
          Tone.getDestination().volume.value = -Infinity;
        } catch (error) {
          playerLogger.error('[usePlayerStore] Tone.js 정지 중 오류:', error);
        }

        await get().clearImages();
        await get().clearAudios();

        set({
          isPlaying: false,
          isPaused: false,
          isPlayTransitioning: false,
          error: null,
          loading: false,
        });
      },
      downloadImage: async (imageUrl: string) => {
        if (!imageUrl) return null;

        const isApp = await flutterIsApp();

        // 1. 모듈 레벨 캐시 확인 (이미 프리로드 완료된 이미지)
        if (imageMemoryCache.has(imageUrl)) {
          playerLogger.log(`[usePlayerStore] 이미지 캐시 히트: ${imageUrl}`);
          return imageMemoryCache.get(imageUrl) ?? null;
        }

        // ✅ 앱 환경: fetch 안 함, 원본 URL 반환 (shouldInterceptRequest가 처리)
        if (isApp) {
          playerLogger.log(`[usePlayerStore] 앱 환경 - 원본 URL 반환 (fetch 스킵): ${imageUrl}`);
          imageMemoryCache.set(imageUrl, imageUrl);
          imageMemoryCacheSize.set(imageUrl, null);
          return imageUrl;
        }

        // 2. 다운로드 진행 중인지 확인 (중복 방지)
        if (pendingImageDownloads.has(imageUrl)) {
          playerLogger.log(`[usePlayerStore] 이미지 다운로드 대기 중: ${imageUrl}`);
          return pendingImageDownloads.get(imageUrl) ?? null;
        }

        // 3. 웹 환경만: 새로운 다운로드 시작 (재시도 로직 포함)
        playerLogger.log(`[usePlayerStore] 이미지 다운로드 시작: ${imageUrl}`);
        const downloadPromise = new Promise<string | null>(async (resolve) => {
          const maxRetries = 3;
          let lastError: any = null;

          if (typeof navigator !== "undefined" && !navigator.onLine) {
            playerLogger.warn(
              `[usePlayerStore] 이미지 다운로드 생략(offline): ${imageUrl}`,
            );
            resolve(null);
            return;
          }

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              if (attempt > 0) {
                // 재시도 전 대기 (지수 백오프: 1s, 2s, 4s)
                const delay = Math.pow(2, attempt - 1) * 1000;
                playerLogger.log(`[usePlayerStore] 이미지 재시도 대기 중 (${attempt}/${maxRetries - 1}): ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));
              }

              playerLogger.log(`[usePlayerStore] 이미지 다운로드 시도 ${attempt + 1}/${maxRetries}: ${imageUrl}`);

              const resolvedImageUrl =
                typeof imageUrl === "string"
                  ? isLibMediaPath(imageUrl)
                    ? getLibMediaUrl(imageUrl)
                    : getMediaUrl(imageUrl, "image")
                  : "";
              const fetchUrl = resolvedImageUrl ? getFetchUrl(resolvedImageUrl) : "";
              if (!fetchUrl) {
                lastError = new Error("이미지 URL이 비어 있음");
                continue;
              }
              const response = await fetch(fetchUrl, { mode: "cors", cache: "reload", credentials: "omit" });

              // 응답 상태 확인
              if (!response.ok) {
                const isRetryableError = [503, 502, 504, 429].includes(response.status);
                playerLogger.log(`[usePlayerStore] HTTP ${response.status} 오류 (재시도 가능: ${isRetryableError})`);

                if (!isRetryableError) {
                  // 재시도 불가능한 오류 (404, 403 등)는 즉시 실패
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // 재시도 가능한 오류는 다음 시도로
                lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                continue;
              }

              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);

              // 모듈 레벨 캐시에 저장 (Zustand 상태 업데이트 없음)
              imageMemoryCache.set(imageUrl, blobUrl);
              imageMemoryCacheSize.set(imageUrl, blob.size);
              playerLogger.log(`[usePlayerStore] 이미지 다운로드 완료 및 캐시 저장 (시도 ${attempt + 1}): ${imageUrl}`);

              resolve(blobUrl);
              return; // 성공 시 종료
            } catch (error) {
              lastError = error;
              playerLogger.error(`[usePlayerStore] 이미지 다운로드 실패 (시도 ${attempt + 1}/${maxRetries}):`, error);

              if (shouldSkipMediaDownloadRetries()) {
                playerLogger.warn(
                  `[usePlayerStore] 이미지 오프라인 — 재시도 생략: ${imageUrl}`,
                );
                resolve(null);
                return;
              }

              // 마지막 시도가 아니면 재시도
              if (attempt < maxRetries - 1) {
                continue;
              }
            }
          }

          // 모든 재시도 실패
          playerLogger.error(`[usePlayerStore] 이미지 다운로드 최종 실패 (${maxRetries}회 시도):`, lastError);
          resolve(null);
        });

        // 다운로드 완료 후 pending에서 제거
        downloadPromise.finally(() => {
          pendingImageDownloads.delete(imageUrl);
        });

        // pending에 등록
        pendingImageDownloads.set(imageUrl, downloadPromise);
        return downloadPromise;
      },
      preloadImages:  async (imageUrls) => {
        const { downloadImage } = get();

        // Flutter 앱 환경 체크
        const isApp = await flutterIsApp();
        console.log('[usePlayerStore] 🔍 flutterIsApp 결과:', isApp);
        console.log('[usePlayerStore] 🔍 imageUrls.length:', imageUrls.length);

        if (isApp && imageUrls.length > 0) {
          console.log('[usePlayerStore] ✅ Flutter 병렬 다운로드 시작!');
          playerLogger.log(`[usePlayerStore] Flutter 병렬 이미지 다운로드 시작: ${imageUrls.length}개`);
          // Flutter Dio 병렬 다운로드 호출
          const flutterSuccess = await flutterDownloadFiles(imageUrls);

          if (flutterSuccess) {
            playerLogger.log('[usePlayerStore] Flutter 병렬 이미지 다운로드 완료');
            // ✅ 이미지는 shouldInterceptRequest가 로컬 파일 제공
            // blob URL 생성 불필요 - 원본 URL을 캐시에 등록만 함
            imageUrls.forEach(url => {
              imageMemoryCache.set(url, url); // blob URL 대신 원본 URL
              imageMemoryCacheSize.set(url, null);
            });
            playerLogger.log(`[usePlayerStore] 이미지 캐시 등록 완료 (blob URL 생성 스킵): ${imageUrls.length}개`);
            return imageUrls;
          } else {
            playerLogger.log('[usePlayerStore] Flutter 다운로드 실패, 웹 fetch로 대체');
          }
        }

        // 웹 환경: lib 이미지(webtoon/...)는 fetch 프리로드 대신 브라우저가 직접 렌더하도록 한다.
        // dobedub-contents 버킷은 CORS 상태에 따라 fetch 프리로드가 대기 상태로 남을 수 있어,
        // direct URL을 캐시에 넣고 즉시 렌더 경로를 열어 주는 편이 안정적이다.
        const IMAGE_PRELOAD_CONCURRENCY = 8;
        const tasks = imageUrls.map((url) => async () => {
          const resolvedUrl =
            typeof url === "string"
              ? isLibMediaPath(url)
                ? getLibMediaUrl(url)
                : getMediaUrl(url, "image")
              : "";

          if (resolvedUrl && resolvedUrl.startsWith(LIB_MEDIA_BASE)) {
            imageMemoryCache.set(url, resolvedUrl);
            imageMemoryCacheSize.set(url, null);
            return resolvedUrl;
          }

          return await downloadImage(url);
        });

        const results: Array<string | null> = new Array(tasks.length);
        let i = 0;
        const workers = Array.from(
          { length: Math.min(IMAGE_PRELOAD_CONCURRENCY, tasks.length) },
          async () => {
            while (i < tasks.length) {
              const idx = i++;
              results[idx] = await tasks[idx]!();
            }
          }
        );
        await Promise.all(workers);
        return results;
      },
      resetImageLoadingStatus: () => {
        set({
          imageLoadingStatus: new Map(),
          pendingDownloads: new Map(),
        });
      },
      clearImages: async () => {
        // 모듈 레벨 캐시의 blob URL 해제
        imageMemoryCache.forEach((blobUrl) => {
          if (blobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(blobUrl);
          }
        });
        imageMemoryCache.clear();
        imageMemoryCacheSize.clear();
        pendingImageDownloads.clear();

        playerLogger.log('[usePlayerStore] 이미지 캐시 클리어 완료');

        // Zustand 상태도 초기화 (legacy 코드 호환성)
        set({ imageCache: new Map() });
        get().resetImageLoadingStatus();
      },
      // 스마트 캐시: 필요한 URL만 유지하고 나머지 정리
      clearUnusedImages: async (keepUrls: Set<string>) => {
        let removedCount = 0;
        const urlsToRemove: string[] = [];

        // 삭제할 URL 목록 수집
        imageMemoryCache.forEach((blobUrl, originalUrl) => {
          if (!keepUrls.has(originalUrl)) {
            urlsToRemove.push(originalUrl);
          }
        });

        // blob URL 해제 및 캐시에서 제거
        for (const url of urlsToRemove) {
          const blobUrl = imageMemoryCache.get(url);
          if (blobUrl && blobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(blobUrl);
          }
          imageMemoryCache.delete(url);
          imageMemoryCacheSize.delete(url);
          removedCount++;
        }

        playerLogger.log(`[usePlayerStore] 스마트 이미지 캐시 정리: ${removedCount}개 제거, ${imageMemoryCache.size}개 유지`);
        return removedCount;
      },
      downloadAudio: async (audioUrl: string, type: MediaUrlType = "audio") => {
        if (!audioUrl) return null;

        // 1. 모듈 레벨 캐시 확인 (Zustand 상태 업데이트 없음)
        if (audioMemoryCache.has(audioUrl)) {
          playerLogger.log(`[usePlayerStore] 오디오 캐시 히트: ${audioUrl}`);
          return audioMemoryCache.get(audioUrl) ?? null;
        }

        // 2. 다운로드 진행 중인지 확인 (중복 방지)
        if (pendingAudioDownloads.has(audioUrl)) {
          playerLogger.log(`[usePlayerStore] 오디오 다운로드 대기 중: ${audioUrl}`);
          return pendingAudioDownloads.get(audioUrl) ?? null;
        }

        // 3. 새로운 다운로드 시작 (재시도 로직 포함) — fetch → blob URL (CORS 우회)
        playerLogger.log(`[usePlayerStore] 오디오 다운로드 시작: ${audioUrl}`);
        const downloadPromise = new Promise<string | null>(async (resolve) => {
          const maxRetries = 3;
          let lastError: any = null;

          if (typeof navigator !== "undefined" && !navigator.onLine) {
            playerLogger.warn(
              `[usePlayerStore] 오디오 다운로드 생략(offline): ${audioUrl}`,
            );
            resolve(null);
            return;
          }

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              if (attempt > 0) {
                const delay = Math.pow(2, attempt - 1) * 1000;
                playerLogger.log(`[usePlayerStore] 오디오 재시도 대기 중 (${attempt}/${maxRetries - 1}): ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));
              }

              playerLogger.log(`[usePlayerStore] 오디오 다운로드 시도 ${attempt + 1}/${maxRetries}: ${audioUrl}`);

              const resolvedUrl =
                typeof audioUrl === "string"
                  ? isLibMediaPath(audioUrl)
                    ? getLibMediaUrl(audioUrl)
                    : getMediaUrl(audioUrl, type)
                  : "";
              if (!resolvedUrl) {
                lastError = new Error("오디오 URL이 비어 있음");
                continue;
              }
              const fetchUrl = getFetchUrl(resolvedUrl);
              const response = await fetch(fetchUrl, { cache: "reload", credentials: "omit" });

              // 응답 상태 확인
              if (!response.ok) {
                const isRetryableError = [503, 502, 504, 429].includes(response.status);
                playerLogger.log(`[usePlayerStore] HTTP ${response.status} 오류 (재시도 가능: ${isRetryableError})`);

                if (!isRetryableError) {
                  // 재시도 불가능한 오류 (404, 403 등)는 즉시 실패
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // 재시도 가능한 오류는 다음 시도로
                lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                continue;
              }

              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);

              // 모듈 레벨 캐시에 저장 (Zustand 상태 업데이트 없음)
              audioMemoryCache.set(audioUrl, blobUrl);
              playerLogger.log(`[usePlayerStore] 오디오 다운로드 완료 및 캐시 저장 (시도 ${attempt + 1}): ${audioUrl}`);

              resolve(blobUrl);
              return; // 성공 시 종료
            } catch (error: unknown) {
              lastError = error;
              const msg = error instanceof Error ? error.message : String(error);
              playerLogger.error(`[usePlayerStore] 오디오 다운로드 실패 (시도 ${attempt + 1}/${maxRetries}): ${msg}`, error);
              if (msg.includes("CORS") || msg.includes("Failed to fetch")) {
                playerLogger.error("[usePlayerStore] S3 버킷 CORS 설정 확인 또는 프록시 사용 중인지 확인");
              }

              if (shouldSkipMediaDownloadRetries()) {
                playerLogger.warn(
                  `[usePlayerStore] 오디오 오프라인 — 재시도 생략: ${audioUrl}`,
                );
                resolve(null);
                return;
              }

              // 마지막 시도가 아니면 재시도
              if (attempt < maxRetries - 1) {
                continue;
              }
            }
          }

          // 모든 재시도 실패
          playerLogger.error(`[usePlayerStore] 오디오 다운로드 최종 실패 (${maxRetries}회 시도):`, lastError);
          resolve(null);
        });

        // 다운로드 완료 후 pending에서 제거
        downloadPromise.finally(() => {
          pendingAudioDownloads.delete(audioUrl);
        });

        // pending에 등록
        pendingAudioDownloads.set(audioUrl, downloadPromise);
        return downloadPromise;
      },
      preloadAudios: async (audioUrls) => {
        const { downloadAudio } = get();

        if (audioUrls.length === 0) return [];

        // ✅ 오디오는 웹 fetch만 사용 (Tone.js가 blob URL 필요)
        // Promise.all로 일괄 처리 - 브라우저가 자동으로 동시 연결 제한 적용
        playerLogger.log(`[usePlayerStore] 오디오 다운로드 시작: ${audioUrls.length}개`);

        const AUDIO_PRELOAD_CONCURRENCY = 6;
        const tasks = audioUrls.map((url) => async () => await downloadAudio(url));
        const results: Array<string | null> = new Array(tasks.length);
        let i = 0;
        const workers = Array.from(
          { length: Math.min(AUDIO_PRELOAD_CONCURRENCY, tasks.length) },
          async () => {
            while (i < tasks.length) {
              const idx = i++;
              results[idx] = await tasks[idx]!();
            }
          }
        );
        await Promise.all(workers);

        playerLogger.log(`[usePlayerStore] 오디오 다운로드 완료: ${results.length}개`);
        return results;
      },
      clearAudios: async () => {
        // 모듈 레벨 캐시의 blob URL 해제
        audioMemoryCache.forEach((blobUrl) => {
          if (blobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(blobUrl);
          }
        });
        audioMemoryCache.clear();
        pendingAudioDownloads.clear();

        playerLogger.log('[usePlayerStore] 오디오 캐시 클리어 완료');

        // Zustand 상태도 초기화 (legacy 코드 호환성)
        set({ audioCache: new Map(), audioPendingDownloads: new Map() });
      },
      getCachedAudioUrl: (originalUrl: string) => {
        // 모듈 레벨 캐시에서 blob URL 반환
        return audioMemoryCache.get(originalUrl) ?? null;
      },
      loadVogopangContent: async (site: "kids" | "edu" | "senior" | "lib" = "edu") => {
        try {
          set({ loading: true });
          const url = `/api/vogopang-content?site=${site}`;
          playerLogger.log("[loadVogopangContent] fetch", url);
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = await res.arrayBuffer();
          const content = decode(new Uint8Array(buf)) as VogopangContent;
          if (!hasPlayableContentImages(content)) {
            throw new Error("Invalid vogopang content");
          }
          set({ content, loading: false });
          playerLogger.log("[loadVogopangContent] ok, images:", getPlaybackContentImages(content).length);
          return true;
        } catch (err) {
          playerLogger.error("[loadVogopangContent] error", err);
          set({ loading: false });
          const { openErrorDialog } = useErrorDialogStore.getState();
          openErrorDialog(err instanceof Error ? err.message : "콘텐츠를 불러오지 못했습니다.");
          return false;
        }
      },
      loadVogopangContentByUuid: async (site: "kids" | "edu" | "senior", playerUuid: string) => {
        try {
          set({ loading: true });
          const url = `/api/vogopang-content?site=${site}&player_uuid=${encodeURIComponent(playerUuid)}`;
          playerLogger.log("[loadVogopangContentByUuid] fetch", url);
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = await res.arrayBuffer();
          const content = decode(new Uint8Array(buf)) as VogopangContent;
          if (!hasPlayableContentImages(content)) {
            throw new Error("Invalid vogopang content");
          }
          set({ content, loading: false });
          playerLogger.log("[loadVogopangContentByUuid] ok, images:", getPlaybackContentImages(content).length);
          return true;
        } catch (err) {
          playerLogger.error("[loadVogopangContentByUuid] error", err);
          set({ loading: false });
          const { openErrorDialog } = useErrorDialogStore.getState();
          openErrorDialog(err instanceof Error ? err.message : "콘텐츠를 불러오지 못했습니다.");
          return false;
        }
      },
      loadLibContentByPlayerKey: async (playerKey: string) => {
        try {
          set({ loading: true });

          if (!isAllowedPlayerKey(playerKey)) {
            throw new Error("Invalid or disallowed playerKey");
          }

          const url = getLocalPlayerJsonPath(playerKey);
          if (!url) {
            throw new Error("Invalid local player JSON path");
          }

          playerLogger.log("[loadLibContentByPlayerKey] fetch local JSON", url);
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const payload = (await res.json()) as Record<string, unknown>;
          const normalized = normalizeBackendPayload(payload);
          const { content } = normalized;
          if (!hasPlayableContentImages(content)) {
            throw new Error("Invalid player content");
          }

          const nav = extractSeriesEpisodeNavFromPlayerInfoPayload(payload);
          set({
            content,
            loading: false,
            playerSeriesEpisodeNav: nav,
          });
          playerLogger.log(
            "[loadLibContentByPlayerKey] ok local JSON, images:",
            getPlaybackContentImages(content).length,
            "normalizedFrom:",
            normalized.path,
            "episodeNav:",
            nav?.items?.length ?? 0,
          );
          return true;
        } catch (err) {
          playerLogger.error("[loadLibContentByPlayerKey] error", err);
          set({ loading: false });
          useGlobalSnackBarStore.getState().showSnackBar(PLAYER_LIB_LOAD_BLOCKED_USER_MESSAGE);
          return false;
        }
      },
      getVersion: () => get().content?.format_version ?? 'V1',
      hasV2: () => {
        const format = String(get().content?.format_version ?? "").toUpperCase();
        return format.includes("V2") || Boolean(get().content?.playback_manifest);
      },
      hasV0: () => false,
      openAutoPlayDialog: () => set({ isOpenAutoPlayDialog: true }),
      closeAutoPlayDialog: () => set({ isOpenAutoPlayDialog: false }),
      handleControl: async (
        type: PlayerControlType,
        dependencies: PlayerControlDependencies,
        options?: { startMs?: number }
      ) => {
        const { toonWork, setState } = dependencies;
        const store = get();

        switch (type) {
          case PlayerControlType.stop:
            toonWork.stop();
            setState.setIsPlaying(false);
            break;
          case PlayerControlType.play: {
            // 중복 클릭 방지
            if (store.isPlayTransitioning) {
              playerLogger.log('[PlayerStore] Play already in progress, ignoring duplicate click');
              return;
            }

            set({ isPlayTransitioning: true });

            let audioMode: PlaybackAudioMode = "enabled";

            try {
              const Tone = await import('tone');

              playerLogger.log('[PlayerStore] 현재 AudioContext 상태:', Tone.getContext().state);

              // AudioContext를 running 상태로 만들고 확인
              const contextState = Tone.getContext().state as AudioContextState;
              let audioContextReady = contextState === 'running';
              if (contextState !== 'running') {
                playerLogger.log('[PlayerStore] AudioContext가 running 상태가 아님, resume 시도');

                const audioReady = await waitForAudioContextRunning({
                  getState: () => Tone.getContext().state as AudioContextState,
                  resume: () => Tone.getContext().resume(),
                  totalTimeoutMs: 3000,
                  resumeTimeoutMs: 500,
                  pollIntervalMs: 100,
                });

                playerLogger.log(
                  '[PlayerStore] AudioContext 최종 상태:',
                  audioReady.state,
                  '성공:',
                  audioReady.ok,
                );
                audioContextReady = audioReady.ok;
              }

              const audioPolicy = resolvePlaybackAudioStartPolicy({
                isPlaybackV2Content: store.hasV2(),
                audioContextReady,
              });
              audioMode = audioPolicy.audioMode;

              if (audioPolicy.shouldNotifyAudioFailure) {
                playerLogger.error('[PlayerStore] AudioContext를 running 상태로 만들지 못했습니다.');
                if (audioPolicy.canStartPlayback) {
                  notify.info('오디오 시스템을 시작할 수 없어 화면 재생만 시작합니다.');
                } else {
                  notify.error('오디오 시스템을 시작할 수 없습니다. 페이지를 새로고침해주세요.');
                }
              }

              if (!audioPolicy.canStartPlayback) {
                set({ isPlayTransitioning: false });
                return;
              }

              // 중지된 음성이 재생되지 않도록 항상 완전히 정리
              playerLogger.log('[PlayerStore] Cleaning Tone.js transport before play');
              Tone.getTransport().stop();
              Tone.getTransport().cancel();
            } catch (e) {
              playerLogger.error('[PlayerStore] Failed to prepare Tone.js context', e);
              const audioPolicy = resolvePlaybackAudioStartPolicy({
                isPlaybackV2Content: store.hasV2(),
                audioContextReady: false,
              });
              audioMode = audioPolicy.audioMode;
              if (!audioPolicy.canStartPlayback) {
                notify.error('오디오 시스템 오류가 발생했습니다. 페이지를 새로고침해주세요.');
                set({ isPlayTransitioning: false });
                return;
              }
              notify.info('오디오 시스템 오류로 화면 재생만 시작합니다.');
            }

            // 재생 중이었다면 먼저 중지
            if (!toonWork.isStop) {
              playerLogger.log('[PlayerStore] Stopping current playback before restart');
              toonWork.stop();
            }

            // Tone.js 정리 후 안정적인 재생을 위해 짧은 딜레이
            playerLogger.log('[PlayerStore] Starting new playback after delay');
            setTimeout(() => {
              toonWork.play({
                startMs: options?.startMs,
                audioMode,
              });
              setState.setIsPlaying(true);
              set({ isPlayTransitioning: false });
            }, 150);
            break;
          }
          case PlayerControlType.pause:
            toonWork.stop();
            setState.setIsPlaying(false);
            setState.setIsPaused(false);
            break;
          case PlayerControlType.touch:
            if (!toonWork.isStop) {
              const newPaused = !get().isPaused;
              setState.setIsPaused(newPaused);
              set({ isPaused: newPaused });
            }
            break;
          case PlayerControlType.casting:
            toonWork.stop();
            setState.setIsPlaying(false);
            break;
          case PlayerControlType.autoPlay: {
            // sessionStorage에서 현재 상태 읽기
            const currentAutoPlay = sessionStorage.getItem('isAutoPlay') === 'true';
            const currentInitAutoPlay = sessionStorage.getItem('isInitAutoPlay') === 'true';
            const nextAutoPlay = !currentAutoPlay;

            playerLogger.log('[handleControl] autoPlay 토글 시도', {
              current: currentAutoPlay,
              next: nextAutoPlay,
              isInitAutoPlay: currentInitAutoPlay
            });

            // 처음 켜는 경우 안내 다이얼로그 표시
            if (nextAutoPlay && !currentInitAutoPlay) {
              playerLogger.log('[handleControl] 첫 번째 정주행 모드 켜기 - 확인 다이얼로그 표시');
              const {openErrorConfirmDialog} = useErrorDialogStore.getState();
              openErrorConfirmDialog('정주행 모드 안내',
                '빠르게 다음 회차를 감상해 보세요!\n정주행 모드 시 다음 회차 열람 및 자동 푸딩 차감됩니다.\n정주행 버튼을 다시 선택하여 정주해 모드를 해제할 수 있습니다.',
                () => {
                  playerLogger.log('[handleControl] 정주행 모드 확인 - 활성화');
                  sessionStorage.setItem('isAutoPlay', 'true');
                  sessionStorage.setItem('isInitAutoPlay', 'true');
                },
                { showCancel: true });
              return;
            }

            // 토글 실행
            playerLogger.log('[handleControl] 정주행 모드 토글 실행', { newValue: nextAutoPlay });
            sessionStorage.setItem('isAutoPlay', String(nextAutoPlay));
            break;
          }
          case PlayerControlType.clearText: {
            if (!store.hasV2()) {
              notify.info("잠시 준비중입니다.");
              return;
            }
            if (get().isImageTransitioning) return;
            const nextClearTextState = !store.isClearText;
            set({ isClearText: nextClearTextState });
            break;
          }
          case PlayerControlType.muted:
            toonWork.toggleMute(!store.isMuted);
            set({ isMuted: !store.isMuted });
            break;
          case PlayerControlType.next: {
            const { router, currentPlayerKey, currentEpisodeId } = dependencies;
            const apiNav = get().playerSeriesEpisodeNav;
            if (!apiNav || apiNav.items.length === 0) {
              notify.info("에피소드 목록이 없어 다음 화로 이동할 수 없습니다.");
              break;
            }
            const idx = apiNav.items.findIndex((i) => i.id === currentEpisodeId);
            if (idx < 0) {
              notify.info("이 회차는 목록에 없어 다음 화로 이동할 수 없습니다.");
              break;
            }
            if (idx >= apiNav.items.length - 1) {
              notify.info("마지막 화입니다.");
              break;
            }
            const nextId = apiNav.items[idx + 1].id;
            set({ isEpisodeListOpen: false });
            router.push(
              `/player/${currentPlayerKey}?seriesId=${apiNav.seriesId}&episodeId=${nextId}`,
            );
            break;
          }
          case PlayerControlType.list:
            set({ isEpisodeListOpen: !get().isEpisodeListOpen });
            break;
          case PlayerControlType.prev: {
            const { router, currentPlayerKey, currentEpisodeId } = dependencies;
            const apiNav = get().playerSeriesEpisodeNav;
            if (!apiNav || apiNav.items.length === 0) {
              notify.info("에피소드 목록이 없어 이전 화로 이동할 수 없습니다.");
              break;
            }
            const idx = apiNav.items.findIndex((i) => i.id === currentEpisodeId);
            if (idx < 0) {
              notify.info("이 회차는 목록에 없어 이전 화로 이동할 수 없습니다.");
              break;
            }
            if (idx <= 0) {
              notify.info("첫 화입니다.");
              break;
            }
            const prevId = apiNav.items[idx - 1].id;
            set({ isEpisodeListOpen: false });
            router.push(
              `/player/${currentPlayerKey}?seriesId=${apiNav.seriesId}&episodeId=${prevId}`,
            );
            break;
          }
        }
      },
      resetPlayerData: () => {
        playerLogger.log("[resetPlayerData] 플레이어 데이터 초기화 (사용자 설정 유지)");
        set({
          content: null,
          isPlaying: false,
          isPaused: false,
          isPlayTransitioning: false,
          loading: false,
          error: null,
          isOpenAutoPlayDialog: false,
          isEpisodeListOpen: false,
          isImageTransitioning: false,
          playerSeriesEpisodeNav: null,
        });
      }
    };
  },
    {
      name: 'player-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // 사용자 설정만 localStorage에 저장
        // playerInfo, seriesId, episodeId 등은 sessionStorage 티켓으로 관리
        isMuted: state.isMuted,
        isClearText: state.isClearText,
      }),
    }
  )
);
