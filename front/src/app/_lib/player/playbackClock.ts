import { buildPlaybackEvents } from "./buildPlaybackEvents";
import type { PlaybackEvent } from "./buildPlaybackEvents";
import type { PlayerManifest } from "./playerManifest.types";
import { resolveVisualFrame } from "./resolveVisualFrame";

export function advancePlaybackTime(
  currentTime: number,
  durationMs: number,
  deltaMs: number,
) {
  return Math.min(Math.max(currentTime + deltaMs, 0), durationMs);
}

export function getPlaybackSnapshot(
  manifest: PlayerManifest,
  currentTime: number,
): {
  currentTime: number;
  visualFrame: ReturnType<typeof resolveVisualFrame>;
  activeEvents: PlaybackEvent[];
  isComplete: boolean;
} {
  const clampedTime = Math.min(Math.max(currentTime, 0), manifest.durationMs);
  const events = buildPlaybackEvents(manifest);

  return {
    currentTime: clampedTime,
    visualFrame: resolveVisualFrame(manifest.items, clampedTime),
    activeEvents: events.filter(
      (event) =>
        event.startTime <= clampedTime && clampedTime < event.endTime,
    ),
    isComplete: clampedTime >= manifest.durationMs,
  };
}
