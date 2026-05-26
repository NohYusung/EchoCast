"use client";

import React from "react";

interface PlayerRecordingWaveformProps {
  audioLevel: number;
  isActive?: boolean;
}

const BAR_COUNT = 24;

export default function PlayerRecordingWaveform({
  audioLevel,
  isActive = false,
}: PlayerRecordingWaveformProps) {
  return (
    <div
      aria-hidden
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${BAR_COUNT}, minmax(0, 1fr))`,
        alignItems: "end",
        gap: "4px",
        height: "80px",
        width: "100%",
      }}
    >
      {Array.from({ length: BAR_COUNT }).map((_, index) => {
        const seed = ((index % 6) + 4) / 10;
        const activeHeight = Math.max(12, Math.min(72, 16 + audioLevel * 56 * seed));
        const idleHeight = 10 + (index % 5) * 4;

        return (
          <span
            key={index}
            style={{
              display: "block",
              width: "100%",
              height: `${isActive ? activeHeight : idleHeight}px`,
              borderRadius: "999px",
              background: isActive ? "#333333" : "#d9d9d9",
              transition: "height 120ms linear, background-color 120ms linear",
            }}
          />
        );
      })}
    </div>
  );
}
