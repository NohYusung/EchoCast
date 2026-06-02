/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import Image from "next/image";
import ToonBox from "@/app/player/_components/toon/ToonBox";
import BaseToonWork from "@/app/player/_components/toon/BaseToonWork";
import { getFetchUrl } from "@/lib/environment";
import type { VogopangContentInlineMedia } from "@/data/vogopangContentTypes";
import {
  buildStoryItemRenderWindow,
  buildVerticalStoryRenderItems,
  getPlaybackContentStoryRenderSource,
  type StoryItemRenderBlock,
  type VerticalStoryRenderItem,
  type VerticalStoryRenderItemPayload,
} from "@/app/player/_lib/storyRenderWindow";
import {
  buildPlaybackCameraTransform,
  normalizePlaybackCameraPosition,
  PLAYBACK_V2_CAMERA_POSITION_EVENT,
  resolvePlaybackViewportTop,
  type PlaybackV2CameraPositionEventDetail,
} from "@/app/player/_lib/playbackCameraViewport";
import {
  buildYouTubeEmbedUrlForPlayback,
  buildYouTubePlayerCommandMessage,
  getYouTubeTargetOrigin,
  inlineMediaPlaybackKey,
  isInlineMediaActiveAtTime,
} from "@/app/player/_lib/inlineMediaPlayback";

interface PlayerViewerProps {
  // Refs
  toonBoxRef: React.RefObject<any>;
  clearTextToonBoxRef: React.RefObject<any>;
  baseToonWorkRef: React.RefObject<any>;
  clearTextBaseToonWorkRef: React.RefObject<any>;
  overlayRef: React.RefObject<HTMLDivElement | null>;

  // Scroll handlers
  handleNormalScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleClearTextScroll: (e: React.UIEvent<HTMLDivElement>) => void;

  // State
  isClearText: boolean;
  isPlaying: boolean;
  showContent: boolean;
  version: string;
  seriesId: number;
  episodeId: number;

  // Store data
  playerInfo: any;
  imageCache: Map<string, string> | null;

  // ToonWork
  calculatedWidth: number;
  workspaceOptions: any;
  isStop: boolean;
  playbackTimeMs: number;

  // Image handlers
  getImageUrl: (image: any) => string;
  getImageKey: (image: any, index: number) => string;
  handleImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  handleClearTextImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;

  /** 재생 중 몰입 모드: 터치 시 상·하단 최소 컨트롤(피크) 토글 */
  onImmersiveTap?: () => void;
}

type ViewportState = {
  scrollTop: number;
  height: number;
};

type ToonStoryPayload = VerticalStoryRenderItemPayload<any, VogopangContentInlineMedia>;
type ToonStoryItem = VerticalStoryRenderItem<any, VogopangContentInlineMedia>;
type ToonStoryBlock = StoryItemRenderBlock<ToonStoryPayload>;

const EMPTY_STORY_ITEMS: ToonStoryItem[] = [];

function inlineMediaRenderOffset(media: VogopangContentInlineMedia): number {
  const value = Number(media.render_image_offset_ratio ?? 1);
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function imageOrder(image: any, index: number): number {
  const order = Number(image?.order ?? index + 1);
  return Number.isFinite(order) ? order : index + 1;
}

function inlineMediaPlacement(media: VogopangContentInlineMedia) {
  const order = Number(media.render_image_order ?? media.after_image_order);
  if (!Number.isFinite(order)) return null;
  return {
    imageOrder: order,
    offsetRatio: inlineMediaRenderOffset(media),
  };
}

function inlineMediaEmbedSrc(
  embedUrl: string,
  origin: string | null,
  shouldAutoplay: boolean,
): string {
  return buildYouTubeEmbedUrlForPlayback(embedUrl, origin, shouldAutoplay);
}

/**
 * PlayerViewer 컴포넌트
 *
 * 일반 이미지 레이어와 ClearText 이미지 레이어를 렌더링하며,
 * 두 레이어 간 스크롤 동기화를 지원합니다.
 */
export const PlayerViewer = React.memo<PlayerViewerProps>(
  ({
    toonBoxRef,
    clearTextToonBoxRef,
    baseToonWorkRef,
    clearTextBaseToonWorkRef,
    overlayRef,
    handleNormalScroll,
    handleClearTextScroll,
    isClearText,
    isPlaying,
    showContent,
    version,
    seriesId,
    episodeId,
    playerInfo,
    imageCache,
    calculatedWidth,
    workspaceOptions,
    isStop,
    playbackTimeMs,
    getImageUrl,
    getImageKey,
    handleImageLoad,
    handleClearTextImageLoad,
    onImmersiveTap,
  }) => {
    const content = playerInfo?.content;
    const playbackV2StoryRenderSource = React.useMemo(
      () => getPlaybackContentStoryRenderSource(content),
      [content],
    );
    const isPlaybackV2Content = Boolean(playbackV2StoryRenderSource);
    const rawInlineMedia =
      playbackV2StoryRenderSource?.inlineMedia ?? content?.inline_media;
    const inlineMedia = React.useMemo(
      () =>
        Array.isArray(rawInlineMedia)
          ? (rawInlineMedia as VogopangContentInlineMedia[])
          : [],
      [rawInlineMedia],
    );
    const inlineMediaIframesRef = React.useRef<Record<string, HTMLIFrameElement | null>>({});
    const activeInlineMediaKeysRef = React.useRef<Set<string>>(new Set());
    const inlineMediaPlaybackTimersRef = React.useRef<Record<string, number[]>>({});
    const [embedOrigin, setEmbedOrigin] = React.useState<string | null>(null);
    const [autoplayInlineMediaKeys, setAutoplayInlineMediaKeys] = React.useState<Set<string>>(
      () => new Set(),
    );
    const [normalViewport, setNormalViewport] = React.useState<ViewportState>({
      scrollTop: 0,
      height: 0,
    });
    const [clearTextViewport, setClearTextViewport] = React.useState<ViewportState>({
      scrollTop: 0,
      height: 0,
    });
    const [v2CameraPositionPx, setV2CameraPositionPx] = React.useState(0);
    const countedNormalImageKeysRef = React.useRef<Set<string>>(new Set());
    const countedClearTextImageKeysRef = React.useRef<Set<string>>(new Set());
    const wasV2CameraPlaybackRef = React.useRef(false);

    const normalImages = React.useMemo(
      () =>
        playbackV2StoryRenderSource?.images ??
        (Array.isArray(content?.images) ? content.images : []),
      [content?.images, playbackV2StoryRenderSource?.images],
    );
    const clearTextImages = React.useMemo(
      () => (Array.isArray(playerInfo?.clearTextImages) ? playerInfo.clearTextImages : []),
      [playerInfo?.clearTextImages],
    );
    const shouldRenderNormalStory =
      showContent &&
      (!playerInfo?.episode ||
        (playerInfo.episode.seriesId === seriesId && playerInfo.episode.id === episodeId));
    const shouldRenderClearTextStory =
      showContent &&
      playerInfo?.episode?.seriesId === seriesId &&
      playerInfo?.episode?.id === episodeId;
    const imageHeightPx = calculatedWidth * 1.5;
    const fallbackViewportHeightPx = Math.max(1, calculatedWidth * 2);
    const normalViewportHeightPx = normalViewport.height || fallbackViewportHeightPx;
    const clearTextViewportHeightPx = clearTextViewport.height || fallbackViewportHeightPx;
    const normalPlaybackViewportTopPx = resolvePlaybackViewportTop({
      isPlaybackV2Content,
      isPlaying,
      cameraPositionPx: v2CameraPositionPx,
      scrollTopPx: normalViewport.scrollTop,
    });
    const clearTextPlaybackViewportTopPx = resolvePlaybackViewportTop({
      isPlaybackV2Content,
      isPlaying,
      cameraPositionPx: v2CameraPositionPx,
      scrollTopPx: clearTextViewport.scrollTop,
    });
    const playbackCameraTransform = buildPlaybackCameraTransform({
      isPlaybackV2Content,
      isPlaying,
      cameraPositionPx: v2CameraPositionPx,
    });
    const normalOverscanPx = Math.max(normalViewportHeightPx, imageHeightPx * 2);
    const clearTextOverscanPx = Math.max(clearTextViewportHeightPx, imageHeightPx * 2);

    React.useEffect(() => {
      setEmbedOrigin(window.location.origin);
    }, []);

    React.useEffect(() => {
      countedNormalImageKeysRef.current.clear();
      countedClearTextImageKeysRef.current.clear();
    }, [episodeId, playerInfo?.content, playerInfo?.clearTextImages, seriesId]);

    React.useEffect(() => {
      const normalElement = toonBoxRef.current?.getScrollableElement?.();
      if (normalElement) {
        setNormalViewport({
          scrollTop: normalElement.scrollTop,
          height: normalElement.clientHeight,
        });
      }

      const clearTextElement = clearTextToonBoxRef.current?.getScrollableElement?.();
      if (clearTextElement) {
        setClearTextViewport({
          scrollTop: clearTextElement.scrollTop,
          height: clearTextElement.clientHeight,
        });
      }
    }, [
      calculatedWidth,
      clearTextToonBoxRef,
      isClearText,
      showContent,
      toonBoxRef,
    ]);

    const setScrollLayerPosition = React.useCallback(
      (positionPx: number) => {
        const nextPositionPx = normalizePlaybackCameraPosition(positionPx);
        const normalElement = toonBoxRef.current?.getScrollableElement?.();
        if (normalElement) {
          normalElement.scrollTop = nextPositionPx;
          setNormalViewport({
            scrollTop: nextPositionPx,
            height: normalElement.clientHeight,
          });
        }

        const clearTextElement = clearTextToonBoxRef.current?.getScrollableElement?.();
        if (clearTextElement) {
          clearTextElement.scrollTop = nextPositionPx;
          setClearTextViewport({
            scrollTop: nextPositionPx,
            height: clearTextElement.clientHeight,
          });
        }
      },
      [clearTextToonBoxRef, toonBoxRef],
    );

    const applyV2CameraPosition = React.useCallback(
      (positionPx: number) => {
        setV2CameraPositionPx(normalizePlaybackCameraPosition(positionPx));
        setScrollLayerPosition(0);
      },
      [setScrollLayerPosition],
    );

    React.useEffect(() => {
      const handleCameraPosition = (event: Event) => {
        const detail = (event as CustomEvent<PlaybackV2CameraPositionEventDetail>).detail;
        applyV2CameraPosition(detail?.positionPx ?? 0);
      };

      window.addEventListener(PLAYBACK_V2_CAMERA_POSITION_EVENT, handleCameraPosition);
      return () => {
        window.removeEventListener(PLAYBACK_V2_CAMERA_POSITION_EVENT, handleCameraPosition);
      };
    }, [applyV2CameraPosition]);

    React.useEffect(() => {
      if (!isPlaybackV2Content) {
        wasV2CameraPlaybackRef.current = false;
        return;
      }

      if (isPlaying) {
        wasV2CameraPlaybackRef.current = true;
        return;
      }

      if (!wasV2CameraPlaybackRef.current) return;
      setScrollLayerPosition(v2CameraPositionPx);
      wasV2CameraPlaybackRef.current = false;
    }, [
      isPlaybackV2Content,
      isPlaying,
      setScrollLayerPosition,
      v2CameraPositionPx,
    ]);

    const clearInlineMediaPlaybackTimers = React.useCallback((key: string) => {
      const timers = inlineMediaPlaybackTimersRef.current[key] ?? [];
      timers.forEach((timer) => window.clearTimeout(timer));
      delete inlineMediaPlaybackTimersRef.current[key];
    }, []);

    const sendInlineMediaCommand = React.useCallback(
      (key: string, media: VogopangContentInlineMedia, command: "mute" | "pauseVideo" | "playVideo") => {
        const iframe = inlineMediaIframesRef.current[key];
        if (!iframe?.contentWindow || !media.embedUrl) return;
        iframe.contentWindow.postMessage(
          buildYouTubePlayerCommandMessage(command),
          getYouTubeTargetOrigin(media.embedUrl),
        );
      },
      [],
    );

    const scheduleInlineMediaPlayback = React.useCallback(
      (key: string, media: VogopangContentInlineMedia) => {
        clearInlineMediaPlaybackTimers(key);

        const sendPlayCommands = () => {
          sendInlineMediaCommand(key, media, "mute");
          sendInlineMediaCommand(key, media, "playVideo");
        };

        sendPlayCommands();
        inlineMediaPlaybackTimersRef.current[key] = [250, 750, 1500, 3000].map((delayMs) =>
          window.setTimeout(sendPlayCommands, delayMs),
        );
      },
      [clearInlineMediaPlaybackTimers, sendInlineMediaCommand],
    );

    const requestInlineMediaAutoplay = React.useCallback((key: string) => {
      setAutoplayInlineMediaKeys((currentKeys) => {
        if (currentKeys.has(key)) return currentKeys;
        const nextKeys = new Set(currentKeys);
        nextKeys.add(key);
        return nextKeys;
      });
    }, []);

    const clearInlineMediaAutoplay = React.useCallback((key: string) => {
      setAutoplayInlineMediaKeys((currentKeys) => {
        if (!currentKeys.has(key)) return currentKeys;
        const nextKeys = new Set(currentKeys);
        nextKeys.delete(key);
        return nextKeys;
      });
    }, []);

    const handleVirtualNormalScroll = React.useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        setNormalViewport({
          scrollTop: e.currentTarget.scrollTop,
          height: e.currentTarget.clientHeight,
        });
        handleNormalScroll(e);
      },
      [handleNormalScroll],
    );

    const handleVirtualClearTextScroll = React.useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        setClearTextViewport({
          scrollTop: e.currentTarget.scrollTop,
          height: e.currentTarget.clientHeight,
        });
        handleClearTextScroll(e);
      },
      [handleClearTextScroll],
    );

    const normalStoryItems = React.useMemo<ToonStoryItem[]>(() => {
      if (!shouldRenderNormalStory) return EMPTY_STORY_ITEMS;
      return buildVerticalStoryRenderItems({
        images: normalImages,
        inlineMedia,
        imageHeightPx,
        inlineMediaWidthPx: calculatedWidth,
        getImageKey,
        getImageOrder: imageOrder,
        getInlineMediaKey: inlineMediaPlaybackKey,
        getInlineMediaPlacement: inlineMediaPlacement,
        getInlineMediaAspectRatio: (media) => media.aspect_ratio,
      });
    }, [
      calculatedWidth,
      getImageKey,
      imageHeightPx,
      inlineMedia,
      normalImages,
      shouldRenderNormalStory,
    ]);

    const clearTextStoryItems = React.useMemo<ToonStoryItem[]>(() => {
      if (!shouldRenderClearTextStory) return EMPTY_STORY_ITEMS;
      return buildVerticalStoryRenderItems({
        images: clearTextImages,
        inlineMedia: [],
        imageHeightPx,
        inlineMediaWidthPx: calculatedWidth,
        getImageKey,
        getImageOrder: imageOrder,
      });
    }, [
      calculatedWidth,
      clearTextImages,
      getImageKey,
      imageHeightPx,
      shouldRenderClearTextStory,
    ]);

    const normalStoryWindow = React.useMemo(
      () =>
        buildStoryItemRenderWindow({
          items: normalStoryItems,
          viewportTopPx: normalPlaybackViewportTopPx,
          viewportHeightPx: normalViewportHeightPx,
          overscanPx: normalOverscanPx,
        }),
      [
        normalOverscanPx,
        normalPlaybackViewportTopPx,
        normalStoryItems,
        normalViewportHeightPx,
      ],
    );

    const clearTextStoryWindow = React.useMemo(
      () =>
        buildStoryItemRenderWindow({
          items: clearTextStoryItems,
          viewportTopPx: clearTextPlaybackViewportTopPx,
          viewportHeightPx: clearTextViewportHeightPx,
          overscanPx: clearTextOverscanPx,
        }),
      [
        clearTextOverscanPx,
        clearTextPlaybackViewportTopPx,
        clearTextStoryItems,
        clearTextViewportHeightPx,
      ],
    );

    React.useEffect(() => {
      const timersByKey = inlineMediaPlaybackTimersRef.current;
      return () => {
        Object.keys(timersByKey).forEach((key) => {
          timersByKey[key]?.forEach((timer) => window.clearTimeout(timer));
          delete timersByKey[key];
        });
      };
    }, []);

    React.useEffect(() => {
      const nextActiveKeys = new Set<string>();

      inlineMedia.forEach((media, mediaIndex) => {
        const key = inlineMediaPlaybackKey(media, mediaIndex);
        const iframe = inlineMediaIframesRef.current[key];
        if (!iframe?.contentWindow) return;

        if (isInlineMediaActiveAtTime(media, playbackTimeMs, isPlaying)) {
          nextActiveKeys.add(key);
          requestInlineMediaAutoplay(key);
          if (!activeInlineMediaKeysRef.current.has(key)) {
            scheduleInlineMediaPlayback(key, media);
          }
        }
      });

      activeInlineMediaKeysRef.current.forEach((key) => {
        if (nextActiveKeys.has(key)) return;
        const mediaIndex = inlineMedia.findIndex(
          (item, index) => inlineMediaPlaybackKey(item, index) === key,
        );
        const media = mediaIndex >= 0 ? inlineMedia[mediaIndex] : null;
        clearInlineMediaPlaybackTimers(key);
        clearInlineMediaAutoplay(key);
        if (media) {
          sendInlineMediaCommand(key, media, "pauseVideo");
        }
      });

      activeInlineMediaKeysRef.current = nextActiveKeys;
    }, [
      clearInlineMediaAutoplay,
      clearInlineMediaPlaybackTimers,
      inlineMedia,
      isPlaying,
      playbackTimeMs,
      requestInlineMediaAutoplay,
      scheduleInlineMediaPlayback,
      sendInlineMediaCommand,
    ]);

    const resolveImageSrc = React.useCallback(
      (image: any) => {
        const path = image.url || image.rawSrc || image.src;
        const cachedImageUrl = path ? imageCache?.get(path) : undefined;
        const resolvedUrl = path ? getImageUrl(image) : "";
        const imageUrl = cachedImageUrl || (resolvedUrl ? getFetchUrl(resolvedUrl) : "");
        return imageUrl && imageUrl.trim()
          ? imageUrl
          : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      },
      [getImageUrl, imageCache],
    );

    const handleDedupedImageLoad = React.useCallback(
      (
        layer: "normal" | "clearText",
        imageKey: string,
        e: React.SyntheticEvent<HTMLImageElement>,
      ) => {
        const countedKeys =
          layer === "normal"
            ? countedNormalImageKeysRef.current
            : countedClearTextImageKeysRef.current;
        if (countedKeys.has(imageKey)) return;
        countedKeys.add(imageKey);

        if (layer === "normal") {
          handleImageLoad(e);
          return;
        }
        handleClearTextImageLoad(e);
      },
      [handleClearTextImageLoad, handleImageLoad],
    );

    const renderInlineMedia = React.useCallback(
      (
        media: VogopangContentInlineMedia,
        mediaIndex: number,
        fillHeight: boolean,
      ) => {
        if (!media.embedUrl) return null;
        const mediaKey = inlineMediaPlaybackKey(media, mediaIndex);
        const isMediaActive = isInlineMediaActiveAtTime(
          media,
          playbackTimeMs,
          isPlaying,
        );
        return (
          <div
            key={mediaKey}
            className="viewer-body-player__inline-media"
            data-player-inline-media="true"
            data-inline-media-key={mediaKey}
            data-inline-media-start-ms={media.start_ms ?? media.startMs ?? ""}
            data-inline-media-duration-ms={media.duration_ms ?? media.durationMs ?? ""}
            style={{
              aspectRatio: media.aspect_ratio ?? "16 / 9",
              height: fillHeight ? "100%" : undefined,
            }}
          >
            <iframe
              ref={(node) => {
                inlineMediaIframesRef.current[mediaKey] = node;
              }}
              src={inlineMediaEmbedSrc(
                media.embedUrl,
                embedOrigin,
                autoplayInlineMediaKeys.has(mediaKey),
              )}
              title={media.title ?? "Inline YouTube video"}
              loading="eager"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              onLoad={() => {
                if (isMediaActive) {
                  scheduleInlineMediaPlayback(mediaKey, media);
                }
              }}
            />
          </div>
        );
      },
      [
        autoplayInlineMediaKeys,
        embedOrigin,
        isPlaying,
        playbackTimeMs,
        scheduleInlineMediaPlayback,
      ],
    );

    const renderImageSegment = React.useCallback(
      (
        payload: Extract<ToonStoryPayload, { kind: "image-segment" }>,
        segmentKey: string,
        layer: "normal" | "clearText",
      ) => {
        if (payload.toRatio <= payload.fromRatio) return null;

        const image = payload.image;
        const imageKey = `${layer}:${getImageKey(image, payload.imageIndex)}`;
        const src = resolveImageSrc(image);
        const topPx = imageHeightPx * payload.fromRatio;
        const segmentHeight = imageHeightPx * (payload.toRatio - payload.fromRatio);
        const shouldCountLoad = payload.countedImage;
        const imagePriority =
          version === "V0"
            ? payload.imageIndex < 3
            : isPlaybackV2Content
              ? payload.imageIndex < 3
              : true;

        if (payload.fromRatio <= 0 && payload.toRatio >= 1) {
          return (
            <Image
              key={segmentKey}
              src={src}
              alt=""
              className="toon-image"
              data-player-counted-image={shouldCountLoad ? "true" : "false"}
              data-image-order={image.order ?? payload.imageIndex + 1}
              width={calculatedWidth}
              height={imageHeightPx}
              sizes={`${calculatedWidth}px`}
              style={{
                height: `${segmentHeight}px`,
                width: "100%",
                display: "block",
              }}
              loading="eager"
              priority={imagePriority}
              onLoad={
                shouldCountLoad
                  ? (e) => handleDedupedImageLoad(layer, imageKey, e)
                  : undefined
              }
              unoptimized={layer === "clearText"}
            />
          );
        }

        return (
          <div
            key={segmentKey}
            className="viewer-body-player__image-segment"
            style={{ height: `${segmentHeight}px` }}
          >
            <Image
              src={src}
              alt=""
              className="toon-image"
              data-player-counted-image={shouldCountLoad ? "true" : "false"}
              data-image-order={image.order ?? payload.imageIndex + 1}
              width={calculatedWidth}
              height={imageHeightPx}
              sizes={`${calculatedWidth}px`}
              style={{
                position: "absolute",
                left: 0,
                top: `${-topPx}px`,
                height: `${imageHeightPx}px`,
                width: "100%",
                maxWidth: "none",
              }}
              loading="eager"
              priority={imagePriority}
              onLoad={
                shouldCountLoad
                  ? (e) => handleDedupedImageLoad(layer, imageKey, e)
                  : undefined
              }
              unoptimized={layer === "clearText"}
            />
          </div>
        );
      },
      [
        calculatedWidth,
        getImageKey,
        handleDedupedImageLoad,
        imageHeightPx,
        isPlaybackV2Content,
        resolveImageSrc,
        version,
      ],
    );

    const renderStoryPayload = React.useCallback(
      (
        payload: ToonStoryPayload,
        itemKey: string,
        layer: "normal" | "clearText",
        fillMediaHeight: boolean,
      ) => {
        if (payload.kind === "inline-media") {
          return renderInlineMedia(payload.media, payload.mediaIndex, fillMediaHeight);
        }
        return renderImageSegment(payload, itemKey, layer);
      },
      [renderImageSegment, renderInlineMedia],
    );

    const renderSequentialStoryItem = React.useCallback(
      (item: ToonStoryItem, layer: "normal" | "clearText") => (
        <React.Fragment key={item.key}>
          {renderStoryPayload(item.payload, item.key, layer, false)}
        </React.Fragment>
      ),
      [renderStoryPayload],
    );

    const renderVirtualStoryBlock = React.useCallback(
      (block: ToonStoryBlock, layer: "normal" | "clearText") => (
        <div
          key={block.key}
          className="viewer-body-player__virtual-block"
          style={{
            top: `${block.topPx}px`,
            height: `${block.heightPx}px`,
          }}
        >
          {renderStoryPayload(block.payload, block.key, layer, true)}
        </div>
      ),
      [renderStoryPayload],
    );

    return (
      <div className="viewer-body">
        <div className="viewer-body-player">
          <div
            className={`viewer-body-player__toon-view ${
              !isStop ? "viewer-body__toon-view--no-interaction" : ""
            }`}
            style={{
              opacity: showContent ? 1 : 0,
              transition: "opacity 400ms ease",
            }}
          >
            {/* isPlaying일 때 모든 상호작용 차단 오버레이 */}
            {isPlaying && (
              <div
                ref={overlayRef}
                className="viewer-body-player__playing-overlay"
                role="button"
                tabIndex={0}
                aria-label="화면을 눌러 재생 컨트롤 표시"
                onPointerUp={(e) => {
                  if (e.pointerType === "mouse" && e.button !== 0) return;
                  onImmersiveTap?.();
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  onImmersiveTap?.();
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  return false;
                }}
                onDragStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  return false;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onImmersiveTap?.();
                    return;
                  }
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onKeyUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onKeyPress={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              />
            )}

            {/* 일반 이미지 레이어 */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: isClearText ? 0 : 1,
                transition: "opacity 1000ms cubic-bezier(0.4, 0, 0.2, 1)",
                pointerEvents: isClearText ? "none" : "auto",
                zIndex: isClearText ? 1 : 2,
                visibility: isClearText ? "hidden" : "visible",
              }}
            >
              <ToonBox
                ref={toonBoxRef}
                onTouchStart={() => {
                  if (isPlaying) {
                    onImmersiveTap?.();
                  }
                }}
                onScroll={handleVirtualNormalScroll}
              >
                <div className="viewer-body-player__toon-content">
                  <BaseToonWork
                    ref={baseToonWorkRef}
                    workspace_options={workspaceOptions}
                    calculatedWidth={calculatedWidth}
                  >
                    {isPlaybackV2Content ? (
                      <div
                        className="viewer-body-player__virtual-story"
                        data-player-renderer="playback-v2-virtual"
                        style={{
                          height: `${normalStoryWindow.totalHeightPx}px`,
                          transform: playbackCameraTransform,
                          willChange: playbackCameraTransform ? "transform" : undefined,
                        }}
                      >
                        {normalStoryWindow.blocks.map((block) =>
                          renderVirtualStoryBlock(block, "normal"),
                        )}
                      </div>
                    ) : (
                      normalStoryItems.map((item) =>
                        renderSequentialStoryItem(item, "normal"),
                      )
                    )}
                  </BaseToonWork>
                </div>
              </ToonBox>
            </div>

            {/* ClearText 이미지 레이어 */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: isClearText ? 1 : 0,
                transition: "opacity 1000ms cubic-bezier(0.4, 0, 0.2, 1)",
                pointerEvents: isClearText ? "auto" : "none",
                zIndex: isClearText ? 2 : 1,
                visibility: isClearText ? "visible" : "hidden",
              }}
            >
              <ToonBox
                ref={clearTextToonBoxRef}
                onTouchStart={() => {
                  if (isPlaying) {
                    onImmersiveTap?.();
                  }
                }}
                onScroll={handleVirtualClearTextScroll}
              >
                <div className="viewer-body-player__toon-content">
                  <BaseToonWork
                    ref={clearTextBaseToonWorkRef}
                    workspace_options={workspaceOptions}
                    calculatedWidth={calculatedWidth}
                  >
                    {isPlaybackV2Content ? (
                      <div
                        className="viewer-body-player__virtual-story"
                        data-player-renderer="playback-v2-cleartext-virtual"
                        style={{
                          height: `${clearTextStoryWindow.totalHeightPx}px`,
                          transform: playbackCameraTransform,
                          willChange: playbackCameraTransform ? "transform" : undefined,
                        }}
                      >
                        {clearTextStoryWindow.blocks.map((block) =>
                          renderVirtualStoryBlock(block, "clearText"),
                        )}
                      </div>
                    ) : (
                      clearTextStoryItems.map((item) =>
                        renderSequentialStoryItem(item, "clearText"),
                      )
                    )}
                  </BaseToonWork>
                </div>
              </ToonBox>
            </div>
          </div>
        </div>

        <style jsx>{`
          .viewer-body {
            width: 100%;
            height: 100%;
            position: relative;
          }

          .viewer-body-player {
            height: 100%;
            width: 100%;
            max-width: ${calculatedWidth}px;
            margin: 0 auto;
            background-color: white;
            position: relative;
          }

          .viewer-body-player__toon-view {
            width: 100%;
            height: 100%;
            position: relative;
            -webkit-overflow-scrolling: touch;
          }

          .viewer-body__toon-view--no-interaction {
            overflow: hidden;
            touch-action: none;
            -ms-touch-action: none;
            overscroll-behavior: contain;
          }

          .viewer-body-player__playing-overlay {
            position: absolute;
            inset: 0;
            background: transparent;
            z-index: 10;
            pointer-events: auto;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            -webkit-user-drag: none;
            -khtml-user-drag: none;
            -moz-user-drag: none;
            -o-user-drag: none;
            user-drag: none;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
          }

          .viewer-body-player__toon-content {
            width: 100%;
            height: 100%;
          }

          .viewer-body-player__virtual-story {
            width: 100%;
            min-height: 100%;
            position: relative;
          }

          .viewer-body-player__virtual-block {
            position: absolute;
            left: 0;
            right: 0;
            overflow: hidden;
            contain: layout paint style;
          }

          .viewer-body-player__inline-media {
            width: 100%;
            background: #000;
            position: relative;
            overflow: hidden;
          }

          .viewer-body-player__image-segment {
            width: 100%;
            position: relative;
            overflow: hidden;
          }

          .viewer-body-player__inline-media iframe {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            border: 0;
            display: block;
          }

          /* 이미지 보호 - 우클릭, 드래그, 선택 방지 */
          .viewer-body-player__toon-content :global(img) {
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            -webkit-user-drag: none;
            -khtml-user-drag: none;
            -moz-user-drag: none;
            -o-user-drag: none;
            user-drag: none;
            pointer-events: auto;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
          }
        `}</style>
      </div>
    );
  }
);

PlayerViewer.displayName = "PlayerViewer";
