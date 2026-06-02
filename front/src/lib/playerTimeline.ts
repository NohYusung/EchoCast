import type { PlaybackManifest, PlaybackScene } from "@/models/playback";

export function getActiveSceneAtMs(
  manifest: PlaybackManifest,
  positionMs: number,
): PlaybackScene | null {
  if (manifest.scenes.length === 0) {
    return null;
  }

  const clampedPosition = Math.min(
    Math.max(positionMs, 0),
    manifest.durationMs,
  );
  const active = manifest.scenes.find(
    (scene) =>
      scene.startMs <= clampedPosition && clampedPosition < scene.endMs,
  );

  return active ?? manifest.scenes[manifest.scenes.length - 1] ?? null;
}

export function getSceneProgress(
  scene: PlaybackScene,
  positionMs: number,
): number {
  const duration = scene.endMs - scene.startMs;
  if (duration <= 0) {
    return 0;
  }

  const progress = (positionMs - scene.startMs) / duration;
  return Math.min(Math.max(progress, 0), 1);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

