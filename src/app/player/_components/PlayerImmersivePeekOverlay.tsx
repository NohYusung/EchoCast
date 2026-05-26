"use client";

import React from "react";
import PlayerControlButton from "@/app/player/_components/control/PlayerControlButton";
import styles from "./PlayerImmersivePeekOverlay.module.scss";

export interface PlayerImmersivePeekOverlayProps {
  visible: boolean;
  isMuted: boolean;
  calculatedWidthCustom: number;
  /** PlayerControls 하단 스택과 맞춘 `bottom` (calc 문자열) */
  bottomOffset: string;
  onPause: () => void;
  onMuteToggle: () => void;
}

/**
 * 재생 중 몰입 모드: 탭 시에만 노출. 레이아웃·음소거 버튼은 PlayerControls 상단 행과 동일.
 */
export function PlayerImmersivePeekOverlay({
  visible,
  isMuted,
  calculatedWidthCustom,
  bottomOffset,
  onPause,
  onMuteToggle,
}: PlayerImmersivePeekOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className={styles.fixedBar}
      style={{ bottom: bottomOffset }}
      role="toolbar"
      aria-label="재생 중 컨트롤"
    >
      <div className={styles.topRow}>
        <div className={styles.mainControls}>
          <PlayerControlButton
            isPlaying
            calculatedWidth={calculatedWidthCustom}
            onHandlePlay={() => {}}
            onHandlePause={onPause}
          />
        </div>
        <button
          type="button"
          className={styles.volumeButton}
          onClick={(e) => {
            e.stopPropagation();
            onMuteToggle();
          }}
          aria-label={isMuted ? "음소거 해제" : "음소거"}
        >
          <img
            src={isMuted ? "/icons/player/soundOff.svg" : "/icons/player/soundOn.svg"}
            alt=""
          />
        </button>
      </div>
    </div>
  );
}
