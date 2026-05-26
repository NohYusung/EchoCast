/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import clsx from "clsx";
import PlayerControlButton from "@/app/player/_components/control/PlayerControlButton";
import { PlayerEpisodeListStrip } from "@/app/player/_components/PlayerEpisodeListStrip";
import type { PlayerEpisodeListItem } from "@/app/player/playerEpisodeListData";
import { PlayerControlType } from "@/app/player/types";
import { usePlayerStore } from "@/stores/usePlayerStore";

interface PlayerRecordingMarker {
  holeUuid: string;
  holeIndex: number;
  startMs: number;
  positionRatio: number;
  isRecorded: boolean;
  isApplied: boolean;
}

interface PlayerRecordingMarkerGroup {
  key: string;
  holeUuid: string;
  count: number;
  hasRecorded: boolean;
  hasApplied: boolean;
  startMs: number;
  startMsList: number[];
  positionRatio: number;
}

const ACTIVE_MULTI_RECORD_MARKER_SRC =
  "data:image/svg+xml;utf8,%3Csvg%20width%3D%2239%22%20height%3D%2239%22%20viewBox%3D%220%200%2039%2039%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Crect%20x%3D%226.72266%22%20width%3D%2232.2759%22%20height%3D%2232.2759%22%20rx%3D%222.68966%22%20fill%3D%22%23333333%22/%3E%3Cpath%20d%3D%22M24.993%2010.6743C24.993%209.38069%2024.0397%208.33203%2022.8637%208.33203C21.6877%208.33203%2020.7344%209.38069%2020.7344%2010.6743V15.3588C20.7344%2016.6523%2021.6877%2017.701%2022.8637%2017.701C24.0397%2017.701%2024.993%2016.6523%2024.993%2015.3588V10.6743Z%22%20stroke%3D%22white%22%20stroke-width%3D%221.06466%22/%3E%3Cpath%20d%3D%22M17.8945%2014.5781V15.3589C17.8945%2016.8083%2018.418%2018.1984%2019.3497%2019.2234C20.2815%2020.2483%2021.5452%2020.8241%2022.8629%2020.8241M22.8629%2020.8241C24.1806%2020.8241%2025.4444%2020.2483%2026.3761%2019.2234C27.3079%2018.1984%2027.8313%2016.8083%2027.8313%2015.3589V14.5781M22.8629%2020.8241V23.9471M22.8629%2023.9471H20.7336M22.8629%2023.9471H24.9922%22%20stroke%3D%22white%22%20stroke-width%3D%221.06466%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3Cpath%20d%3D%22M27.5695%2032.2773H18.8281L23.1988%2039.0015L27.5695%2032.2773Z%22%20fill%3D%22%23333333%22/%3E%3Cpath%20d%3D%22M6.72461%200L6.44922%200.0136719C5.09308%200.151467%204.03526%201.29698%204.03516%202.68945V29.5859C4.03516%2031.0714%205.23915%2032.2754%206.72461%2032.2754H2.68945C1.20409%2032.2753%200%2031.0713%200%2029.5859V2.68945C0.000108909%201.20416%201.20416%200.000109385%202.68945%200H6.72461Z%22%20fill%3D%22%23333333%22/%3E%3C/svg%3E";
const INACTIVE_SINGLE_RECORD_MARKER_SRC =
  "data:image/svg+xml;utf8,%3Csvg%20width%3D%2232%22%20height%3D%2239%22%20viewBox%3D%220%200%2032%2039%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Crect%20y%3D%220.167969%22%20width%3D%2232%22%20height%3D%2232%22%20rx%3D%222.66667%22%20fill%3D%22%23B4B3B3%22/%3E%3Cpath%20d%3D%22M18.1128%2010.748C18.1128%209.46548%2017.1677%208.42578%2016.0017%208.42578C14.8358%208.42578%2013.8906%209.46548%2013.8906%2010.748V15.3924C13.8906%2016.675%2014.8358%2017.7147%2016.0017%2017.7147C17.1677%2017.7147%2018.1128%2016.675%2018.1128%2015.3924V10.748Z%22%20stroke%3D%22white%22%20stroke-width%3D%221.05556%22/%3E%3Cpath%20d%3D%22M11.0742%2014.6172V15.3913C11.0742%2016.8283%2011.5932%2018.2066%2012.517%2019.2227C13.4408%2020.2389%2014.6937%2020.8098%2016.0001%2020.8098M16.0001%2020.8098C17.3066%2020.8098%2018.5595%2020.2389%2019.4833%2019.2227C20.4071%2018.2066%2020.9261%2016.8283%2020.9261%2015.3913V14.6172M16.0001%2020.8098V23.9061M16.0001%2023.9061H13.889M16.0001%2023.9061H18.1113%22%20stroke%3D%22white%22%20stroke-width%3D%221.05556%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3Cpath%20d%3D%22M20%2032.0391H11L15.5%2038.0391L20%2032.0391Z%22%20fill%3D%22%23B4B3B3%22/%3E%3C/svg%3E";

function groupRecordingMarkers(
  markers: PlayerRecordingMarker[],
  calculatedWidthCustom: number,
): PlayerRecordingMarkerGroup[] {
  if (markers.length === 0) {
    return [];
  }

  const isDesktop = calculatedWidthCustom > 768;
  /** 스트립 좌우 패딩 합 (데스크톱 40+40, 모바일 26+26) */
  const horizontalPadding = isDesktop ? 80 : 52;
  const innerWidth = Math.max(1, calculatedWidthCustom - horizontalPadding);
  const overlapThresholdPx = isDesktop ? 18 : 14;

  const sorted = [...markers].sort((a, b) => {
    if (Math.abs(a.positionRatio - b.positionRatio) > 1e-6) {
      return a.positionRatio - b.positionRatio;
    }
    return a.startMs - b.startMs;
  });

  const groups: Array<{
    markers: PlayerRecordingMarker[];
    lastPx: number;
    sumPx: number;
  }> = [];

  for (const marker of sorted) {
    const px = (marker.positionRatio / 100) * innerWidth;
    const previousGroup = groups[groups.length - 1];

    if (previousGroup && px - previousGroup.lastPx <= overlapThresholdPx) {
      previousGroup.markers.push(marker);
      previousGroup.lastPx = px;
      previousGroup.sumPx += px;
      continue;
    }

    groups.push({
      markers: [marker],
      lastPx: px,
      sumPx: px,
    });
  }

  return groups.map((group) => {
    const representativeMarker = [...group.markers].sort((a, b) => {
      if (a.isApplied !== b.isApplied) {
        return a.isApplied ? -1 : 1;
      }
      if (a.isRecorded !== b.isRecorded) {
        return a.isRecorded ? -1 : 1;
      }
      if (a.startMs !== b.startMs) {
        return a.startMs - b.startMs;
      }
      return a.holeIndex - b.holeIndex;
    })[0];
    const sortedStartMsList = group.markers
      .map((marker) => marker.startMs)
      .sort((a, b) => a - b);

    return {
      key: group.markers.map((marker) => marker.holeUuid).join("-"),
      holeUuid: representativeMarker?.holeUuid ?? group.markers[0]?.holeUuid ?? "",
      count: group.markers.length,
      hasRecorded: group.markers.some((marker) => marker.isRecorded),
      hasApplied: group.markers.some((marker) => marker.isApplied),
      startMs: representativeMarker?.startMs ?? sortedStartMsList[0] ?? 0,
      startMsList: sortedStartMsList,
      positionRatio: representativeMarker?.positionRatio ?? 0,
    };
  });
}

interface PlayerControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  playerStoreLoading: boolean;
  calculatedWidthCustom: number;
  currentEpisodeId: number;
  recordingMarkers: PlayerRecordingMarker[];
  onEpisodeSelect: (item: PlayerEpisodeListItem) => void;
  onRecordingMarkerSelect?: (startMs: number, holeUuid?: string) => void;
  handlePlayClick: () => void;
  handleControl: (type: PlayerControlType, options?: any) => Promise<void>;
  /** 재생 중 몰입 모드: 상·하단 컨트롤을 화면 밖으로 숨김 */
  chromeHidden?: boolean;
  onListButtonClick?: () => Promise<void> | void;
}

export const PlayerControls = React.memo<PlayerControlsProps>(
  ({
    isPlaying,
    isMuted,
    playerStoreLoading,
    calculatedWidthCustom,
    currentEpisodeId,
    recordingMarkers,
    onEpisodeSelect,
    onRecordingMarkerSelect,
    handlePlayClick,
    handleControl,
    chromeHidden = false,
    onListButtonClick,
  }) => {
    const isEpisodeListOpen = usePlayerStore((s) => s.isEpisodeListOpen);
    const apiNav = usePlayerStore((s) => s.playerSeriesEpisodeNav);
    const listItems = apiNav?.items ?? [];
    const apiIdx =
      listItems.length > 0
        ? listItems.findIndex((i) => i.id === currentEpisodeId)
        : -1;
    const canEpisodePrev = listItems.length > 0 && apiIdx > 0;
    const canEpisodeNext =
      listItems.length > 0 && apiIdx >= 0 && apiIdx < listItems.length - 1;
    const recordingMarkerGroups = React.useMemo(
      () => groupRecordingMarkers(recordingMarkers, calculatedWidthCustom),
      [recordingMarkers, calculatedWidthCustom],
    );

    React.useEffect(() => {
      if (process.env.NODE_ENV !== "development" || recordingMarkerGroups.length === 0) {
        return;
      }

      console.log(
        "[PlayerControls] recording-marker-groups",
        recordingMarkerGroups.map((group, index) => ({
          order: index + 1,
          count: group.count,
          hasRecorded: group.hasRecorded,
          hasApplied: group.hasApplied,
          startMs: group.startMs,
          startMsList: group.startMsList,
          positionRatio: group.positionRatio,
        })),
      );
    }, [recordingMarkerGroups]);

    const shellRef = React.useRef<HTMLDivElement>(null);
    const estimateShellStackPx = React.useCallback(() => {
      const desktop = calculatedWidthCustom > 768;
      let h = desktop ? 84 : 49;
      if (recordingMarkerGroups.length > 0) h += desktop ? 116 : 90;
      if (isEpisodeListOpen) h += desktop ? 156 : 124;
      return h;
    }, [calculatedWidthCustom, recordingMarkerGroups.length, isEpisodeListOpen]);

    const [shellStackPx, setShellStackPx] = React.useState(estimateShellStackPx);

    React.useLayoutEffect(() => {
      setShellStackPx(estimateShellStackPx());
    }, [estimateShellStackPx]);

    React.useLayoutEffect(() => {
      const el = shellRef.current;
      if (!el) return;
      const read = () => setShellStackPx(Math.round(el.getBoundingClientRect().height));
      read();
      const ro = new ResizeObserver(read);
      ro.observe(el);
      return () => ro.disconnect();
    }, [
      isEpisodeListOpen,
      recordingMarkerGroups.length,
    ]);

    if (playerStoreLoading) {
      return null;
    }

    return (
      <>
        <div
          className={clsx("player-controls-top-region", chromeHidden && "is-chrome-hidden")}
          style={{ bottom: shellStackPx }}
        >
          <div className="player-main-controls">
            <PlayerControlButton
              isPlaying={isPlaying}
              calculatedWidth={calculatedWidthCustom}
              onHandlePlay={handlePlayClick}
              onHandlePause={() => handleControl(PlayerControlType.pause)}
            />

          </div>

          <button
            type="button"
            className="player-volume-button"
            onClick={() => handleControl(PlayerControlType.muted)}
            aria-label={isMuted ? "음소거 해제" : "음소거"}
          >
            <img
              src={isMuted ? "/icons/player/soundOff.svg" : "/icons/player/soundOn.svg"}
              alt=""
            />
          </button>
        </div>

        <div
          ref={shellRef}
          className={clsx("player-controls-shell", chromeHidden && "is-chrome-hidden")}
        >
          {isEpisodeListOpen ? (
            <PlayerEpisodeListStrip
              activeEpisodeId={currentEpisodeId}
              items={listItems}
              onSelectEpisode={onEpisodeSelect}
            />
          ) : null}

          {recordingMarkerGroups.length > 0 ? (
            <div className="player-recording-strip-outer">
            <div className="player-recording-strip" aria-label="녹음 마커 목록">
              <div className="player-recording-strip-inner">
                {recordingMarkerGroups.map((markerGroup, index) => (
                  (() => {
                    return (
                      <button
                        key={markerGroup.key}
                        type="button"
                        className={`player-recording-marker${
                          markerGroup.count > 1 ? " is-stacked" : ""
                        }${markerGroup.hasRecorded ? " is-recorded" : " is-unrecorded"}`}
                        style={{ left: `${markerGroup.positionRatio}%` }}
                        onClick={() => onRecordingMarkerSelect?.(markerGroup.startMs, markerGroup.holeUuid)}
                        aria-label={`${markerGroup.count > 1 ? "복수" : "단일"} 장면 ${index + 1}로 이동`}
                      >
                        {markerGroup.count > 1 ? (
                          <img
                            src={
                              markerGroup.hasRecorded
                                ? ACTIVE_MULTI_RECORD_MARKER_SRC
                                : "/icons/player/multiRecordMarker.svg"
                            }
                            alt=""
                            className="player-recording-marker-icon player-recording-marker-icon-multi"
                          />
                        ) : (
                          <img
                            src={
                              markerGroup.hasRecorded
                                ? "/icons/player/recordMarker.svg"
                                : INACTIVE_SINGLE_RECORD_MARKER_SRC
                            }
                            alt=""
                            className="player-recording-marker-icon player-recording-marker-icon-single"
                          />
                        )}
                      </button>
                    );
                  })()
                ))}
              </div>
              <div className="player-recording-strip-timeline" aria-hidden />
            </div>
            </div>
          ) : null}

          <div className="player-bottom-nav-outer">
          <div className="player-bottom-nav">
            <div className="player-bottom-nav-grid-lead" aria-hidden />

              <button
                type="button"
                className={`player-icon-button${isEpisodeListOpen ? " is-list-active" : ""}`}
                onClick={() => onListButtonClick?.() ?? handleControl(PlayerControlType.list)}
                aria-label="목록"
                aria-expanded={isEpisodeListOpen}
              >
              <img src="/icons/player/list.svg" alt="" />
            </button>

            <div className="player-episode-actions">
              <button
                type="button"
                className={`player-episode-button${canEpisodePrev ? "" : " is-disabled"}`}
                disabled={!canEpisodePrev}
                onClick={() => void handleControl(PlayerControlType.prev)}
              >
                <img src="/icons/common/leftArrow.svg" alt="" />
                <span>이전화</span>
              </button>

              <button
                type="button"
                className={`player-episode-button${canEpisodeNext ? "" : " is-disabled"}`}
                disabled={!canEpisodeNext}
                onClick={() => void handleControl(PlayerControlType.next)}
              >
                <span>다음화</span>
                <img src="/icons/common/leftArrow.svg" alt="" className="is-next" />
              </button>
            </div>
          </div>
          </div>
        </div>

        <style jsx>{`
          /* shell과 형제 — flex 공통 루트 없음. 높이는 ref+ResizeObserver로 top-region bottom에만 반영 */
          .player-controls-top-region {
            position: fixed;
            left: 50%;
            transform: translate(-50%, 0);
            z-index: 1000;
            width: 100%;
            max-width: 1280px;
            box-sizing: border-box;
            height: 84px;
            pointer-events: none;
            transition:
              transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.35s ease;
          }

          .player-controls-top-region.is-chrome-hidden {
            transform: translate(-50%, calc(100% + 32px));
            opacity: 0;
            pointer-events: none;
          }

          .player-controls-shell {
            position: fixed;
            left: 50%;
            bottom: 0;
            transform: translate(-50%, 0);
            z-index: 999;
            width: 100%;
            max-width: 1280px;
            display: flex;
            flex-direction: column;
            transition:
              transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.35s ease;
          }

          .player-controls-shell.is-chrome-hidden {
            transform: translate(-50%, calc(100% + 32px));
            opacity: 0;
            pointer-events: none;
          }

          .player-main-controls {
            position: absolute;
            left: 16px;
            top: 0;
            z-index: 1;
            display: flex;
            align-items: center;
            gap: 16px;
            height: 52px;
            pointer-events: auto;
          }

          .player-voice-toggle {
            display: inline-flex;
            align-items: center;
            padding: 0;
            gap: 0;
            border-radius: 16px;
            background: #ffffff;
            border: 1px solid #e5e5e5;
            overflow: hidden;
          }

          .player-voice-option {
            border: none;
            border-radius: 0;
            background: transparent;
            color: #b4b3b3;
            width: 80px;
            height: 36px;
            padding: 0 10px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            font-weight: 700;
            line-height: normal;
            letter-spacing: -0.28px;
            white-space: nowrap;
            cursor: pointer;
            transition: background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
            border-left: 1px solid #e5e5e5;
            border-right: 1px solid #e5e5e5;
          }

          .player-voice-option.is-active {
            background: #333333;
            color: #ffffff;
          }

          .player-voice-option.is-disabled {
            opacity: 0.38;
            cursor: default;
          }

          .player-volume-button {
            position: absolute;
            right: 16px;
            top: 0;
            z-index: 1;
            display: flex;
            width: 36px;
            height: 52px;
            border: none;
            border-radius: 0;
            background: transparent;
            align-items: center;
            justify-content: center;
            padding: 0;
            cursor: pointer;
            pointer-events: auto;
          }

          .player-volume-button img {
            width: 36px;
            height: 36px;
            display: block;
            opacity: 1;
          }

          .player-bottom-nav {
            background: #ffffff;
            border-top: 1px solid #e5e5e5;
            position: relative;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
            align-items: center;
            column-gap: 8px;
            padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
            white-space: nowrap;
          }

          /* 좌측 플레이스홀더로 동일 3열(1fr | auto | 1fr) 유지 → 목록은 가운데, 회차는 우측 */
          .player-bottom-nav-grid-lead {
            min-width: 0;
          }

          .player-recording-strip {
            position: relative;
            width: 100%;
            min-height: 45px;
            padding: 16px 26px;
            background: #ffffff;
            border-top: 1px solid #e5e5e5;
          }

          .player-recording-strip-inner {
            position: relative;
            width: 100%;
            height: 29px;
          }

          .player-recording-strip-outer {
            width: 100%;
          }

          /* 마커 아래 네비게이션 라인 (::after 대신 DOM — PC 풀블리드·transform 컨텍스트에서도 안정적) */
          .player-recording-strip-timeline {
            display: block;
            width: 100%;
            margin-top: 10px;
            height: 2px;
            min-height: 2px;
            background: #e5e5e5;
            flex-shrink: 0;
            box-sizing: border-box;
            line-height: 0;
            font-size: 0;
          }

          .player-bottom-nav-outer {
            width: 100%;
          }

          .player-recording-marker {
            position: absolute;
            top: 0;
            border: none;
            padding: 0;
            display: inline-flex;
            align-items: flex-start;
            justify-content: center;
            transform: translateX(-50%);
            width: 29px;
            height: 29px;
            background: transparent;
            cursor: pointer;
          }

          .player-recording-marker.is-stacked {
            width: 29px;
          }

          .player-recording-marker-icon {
            display: block;
          }

          .player-recording-marker-icon-single {
            width: 24px;
            height: 29px;
          }

          .player-recording-marker-icon-multi {
            width: 29px;
            height: 29px;
          }

          .player-recording-marker.is-unrecorded .player-recording-marker-icon-multi {
            filter: none;
            opacity: 0.9;
          }

          .player-icon-button,
          .player-episode-button,
          .player-experience-button {
            border: none;
            background: transparent;
            padding: 0;
            display: inline-flex;
            align-items: center;
            cursor: pointer;
            color: #333333;
          }

          .player-icon-button img,
          .player-episode-button img {
            width: 24px;
            height: 24px;
            display: block;
          }

          .player-episode-button span {
            font-size: 12px;
            white-space: nowrap;
          }

          .player-experience-button {
            gap: 4px;
          }

          .player-experience-button img {
            width: 24px;
            height: 24px;
            display: block;
          }

          .player-experience-button span {
            font-size: 12px;
            color: #333333;
            white-space: nowrap;
          }

          .player-icon-button {
            position: static;
            width: 24px;
            height: 24px;
            justify-content: center;
            flex-shrink: 0;
            justify-self: center;
          }

          .player-icon-button.is-list-active img {
            filter: invert(27%) sepia(89%) saturate(7500%) hue-rotate(262deg)
              brightness(89%) contrast(101%);
          }

          .player-episode-actions {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-left: 0;
            justify-self: end;
            flex-wrap: nowrap;
          }

          .player-episode-button {
            gap: 2px;
            flex-shrink: 0;
          }

          .player-experience-button {
            justify-self: start;
            min-width: 0;
            flex-shrink: 0;
          }

          .player-episode-button.is-disabled,
          .player-episode-button:disabled {
            color: #b4b3b3;
            cursor: not-allowed;
          }

          .player-episode-button.is-disabled img,
          .player-episode-button:disabled img {
            opacity: 0.6;
          }

          .player-episode-button .is-next {
            transform: rotate(180deg);
          }

          @media (max-width: 768px) {
            .player-controls-shell,
            .player-controls-top-region {
              width: 100%;
            }

            .player-main-controls {
              gap: 16px;
            }
          }

          @media (min-width: 769px) {
            .player-controls-shell,
            .player-controls-top-region {
              width: 100%;
              max-width: 1280px;
            }

            /* 마커·타임라인: max 1280, 좌우 40px 패딩 안으로 상단 보더·콘텐츠 정렬 */
            .player-recording-strip-outer {
              width: 100%;
              max-width: 1280px;
              margin: 0 auto;
              box-sizing: border-box;
              border-top: none;
              background: #ffffff;
            }

            .player-recording-strip {
              position: relative;
              border-top: none;
              background: transparent;
              width: 100%;
              margin: 0;
              min-height: 54px;
              padding: 24px 40px;
            }

            .player-recording-strip::before {
              content: "";
              position: absolute;
              top: 0;
              left: 40px;
              right: 40px;
              height: 1px;
              background: #e5e5e5;
              pointer-events: none;
            }

            .player-bottom-nav-outer {
              width: 100vw;
              max-width: none;
              margin-left: calc(50% - 50vw);
              box-sizing: border-box;
              border-top: 1px solid #e5e5e5;
              background: #ffffff;
            }

            .player-bottom-nav {
              border-top: none;
              max-width: 1280px;
              margin: 0 auto;
            }

            .player-controls-top-region {
              height: 158px;
            }

            .player-main-controls {
              left: 40px;
              top: 48px;
              height: 70px;
              gap: 24px;
            }

            .player-voice-toggle {
              padding: 0;
              gap: 0;
              border: 1.778px solid #e5e5e5;
              border-radius: 16px;
              background: #ffffff;
              overflow: hidden;
            }

            .player-voice-option {
              width: 142px;
              height: 64px;
              padding: 0 18px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              gap: 18px;
              background: #ffffff;
              font-size: 25px;
              font-style: normal;
              font-weight: 400;
              line-height: normal;
              letter-spacing: -0.5px;
              color: #b4b3b3;
              border-radius: 0;
              border-left: 1.778px solid #e5e5e5;
              border-right: 1.778px solid #e5e5e5;
            }

            .player-volume-button {
              right: 40px;
              top: 48px;
              width: 64px;
              height: 70px;
              border: none;
              background: transparent;
            }

            .player-volume-button img {
              width: 64px;
              height: 64px;
              opacity: 1;
            }

            .player-bottom-nav {
              padding: 24px 40px calc(24px + env(safe-area-inset-bottom));
            }

            .player-recording-strip-inner {
              height: 38px;
            }


            .player-recording-marker {
              width: 39px;
              height: 38px;
            }

            .player-recording-marker.is-stacked {
              width: 39px;
            }

            .player-recording-marker-icon-single {
              width: 32px;
              height: 39px;
            }

            .player-recording-marker-icon-multi {
              width: 39px;
              height: 39px;
            }

            .player-icon-button img,
            .player-episode-button img,
            .player-experience-button img {
              width: 36px;
              height: 36px;
            }

            .player-experience-button {
              gap: 16px;
            }

            .player-experience-button span {
              font-size: 20px;
              line-height: 1;
              letter-spacing: 0.02em;
            }

            .player-icon-button {
              width: 36px;
              height: 36px;
            }

            .player-episode-button {
              gap: 4px;
            }

            .player-episode-button span {
              font-size: 20px;
              line-height: 1;
              letter-spacing: 0.02em;
            }
          }

          @media (min-width: 1200px) {
            .player-controls-top-region {
              height: 190px;
            }

            .player-main-controls {
              top: 60px;
              gap: 32px;
            }

            .player-volume-button {
              top: 60px;
            }
          }
        `}</style>
      </>
    );
  }
);

PlayerControls.displayName = "PlayerControls";
