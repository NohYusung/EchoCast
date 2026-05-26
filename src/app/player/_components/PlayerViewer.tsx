/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import Image from "next/image";
import ToonBox from "@/app/player/_components/toon/ToonBox";
import BaseToonWork from "@/app/player/_components/toon/BaseToonWork";
import { getFetchUrl } from "@/lib/environment";

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

  // Image handlers
  getImageUrl: (image: any) => string;
  getImageKey: (image: any, index: number) => string;
  handleImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  handleClearTextImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;

  /** 재생 중 몰입 모드: 터치 시 상·하단 최소 컨트롤(피크) 토글 */
  onImmersiveTap?: () => void;
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
    getImageUrl,
    getImageKey,
    handleImageLoad,
    handleClearTextImageLoad,
    onImmersiveTap,
  }) => {
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
                onScroll={handleNormalScroll}
              >
                <div className="viewer-body-player__toon-content">
                  <BaseToonWork
                    ref={baseToonWorkRef}
                    workspace_options={workspaceOptions}
                    calculatedWidth={calculatedWidth}
                  >
                    {showContent &&
                      Array.isArray(playerInfo?.content?.images) &&
                      (!playerInfo.episode || (playerInfo.episode.seriesId === seriesId && playerInfo.episode.id === episodeId)) &&
                      playerInfo.content.images.map(
                        (image: any, index: number) => {
                          const path = image.url || image.rawSrc || image.src;
                          const cachedImageUrl = path ? imageCache?.get(path) : undefined;
                          const resolvedUrl = path ? getImageUrl(image) : "";
                          const imageUrl = cachedImageUrl || (resolvedUrl ? getFetchUrl(resolvedUrl) : "");
                          const src = imageUrl && imageUrl.trim() ? imageUrl : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

                          return (
                            <Image
                              key={getImageKey(image, index)}
                              src={src}
                              alt=""
                              className="toon-image"
                              data-image-order={image.order ?? index + 1}
                              width={calculatedWidth}
                              height={calculatedWidth * 1.5}
                              sizes={`${calculatedWidth}px`}
                              style={{ height: "auto", width: "100%", display: "block" }}
                              loading="eager"
                              priority={version === "V0" ? index < 3 : true}
                              onLoad={handleImageLoad}
                              
                            />
                          );
                        }
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
                onScroll={handleClearTextScroll}
              >
                <div className="viewer-body-player__toon-content">
                  <BaseToonWork
                    ref={clearTextBaseToonWorkRef}
                    workspace_options={workspaceOptions}
                    calculatedWidth={calculatedWidth}
                  >
                    {showContent &&
                      Array.isArray(playerInfo?.clearTextImages) &&
                      playerInfo?.episode?.seriesId === seriesId &&
                      playerInfo?.episode?.id === episodeId &&
                      playerInfo.clearTextImages.map(
                        (image: any, index: number) => {
                          const path = image.url || image.rawSrc || image.src;
                          const cachedImageUrl = path ? imageCache?.get(path) : undefined;
                          const resolvedUrl = path ? getImageUrl(image) : "";
                          const imageUrl = cachedImageUrl || (resolvedUrl ? getFetchUrl(resolvedUrl) : "");
                          const src = imageUrl && imageUrl.trim() ? imageUrl : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

                          return (
                            <Image
                              key={`cleartext-${getImageKey(image, index)}`}
                              src={src}
                              alt=""
                              className="toon-image"
                              data-image-order={image.order ?? index + 1}
                              width={calculatedWidth}
                              height={calculatedWidth * 1.5}
                              sizes={`${calculatedWidth}px`}
                              style={{ height: "auto", width: "100%", display: "block" }}
                              loading="eager"
                              priority={version === "V0" ? index < 3 : true}
                              onLoad={handleClearTextImageLoad}
                              unoptimized
                            />
                          );
                        }
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
