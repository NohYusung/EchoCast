import { MarkerHelper } from "@/app/player/_lib/toonWorkCommon";

export type PlaybackSceneNavigationMarker = {
  positionRatio?: number;
  top?: number;
  time_ms?: number;
  startMs?: number;
  index?: number;
};

const SCENE_NAVIGATION_NEAREST_MAX_ERROR_MS = 200;
const SCENE_NAVIGATION_SEGMENT_EDGE_SNAP_MS = 600;

function sceneMarkerTimes(markers: PlaybackSceneNavigationMarker[]): number[] {
  return [
    ...new Set(
      markers
        .map((marker) => marker.time_ms)
        .filter((timeMs): timeMs is number => typeof timeMs === "number" && Number.isFinite(timeMs)),
    ),
  ].sort((a, b) => a - b);
}

function nearestSceneMarkerTimeMs(
  requestedMs: number,
  markers: PlaybackSceneNavigationMarker[],
): number {
  const times = sceneMarkerTimes(markers);
  if (times.length === 0) return requestedMs;

  let best = times[0]!;
  let bestDist = Math.abs(best - requestedMs);
  for (let index = 1; index < times.length; index++) {
    const timeMs = times[index]!;
    const dist = Math.abs(timeMs - requestedMs);
    if (dist < bestDist || (dist === bestDist && timeMs < best)) {
      best = timeMs;
      bestDist = dist;
    }
  }
  return best;
}

function anchorSceneMarkerTimeMs(
  requestedMs: number,
  markers: PlaybackSceneNavigationMarker[],
): number {
  const sorted = sceneMarkerTimes(markers);
  if (sorted.length === 0) return requestedMs;
  if (requestedMs < sorted[0]!) return requestedMs;
  if (requestedMs >= sorted[sorted.length - 1]!) return sorted[sorted.length - 1]!;

  let best = sorted[0]!;
  for (const timeMs of sorted) {
    if (timeMs <= requestedMs) best = timeMs;
    else break;
  }
  return best;
}

export function resolveSceneNavigateTimeMs(
  requestedMs: number,
  markers: PlaybackSceneNavigationMarker[],
): number {
  const sorted = sceneMarkerTimes(markers);
  if (sorted.length >= 2) {
    for (let index = 0; index < sorted.length - 1; index++) {
      const lo = sorted[index]!;
      const hi = sorted[index + 1]!;
      if (requestedMs > lo && requestedMs < hi) {
        const msAfterLo = requestedMs - lo;
        const msBeforeHi = hi - requestedMs;
        const nearestEdgeGapMs = Math.min(msAfterLo, msBeforeHi);
        if (nearestEdgeGapMs <= SCENE_NAVIGATION_SEGMENT_EDGE_SNAP_MS) {
          return msAfterLo <= msBeforeHi ? lo : hi;
        }
        return requestedMs;
      }
    }
  }

  const nearest = nearestSceneMarkerTimeMs(requestedMs, markers);
  if (Math.abs(nearest - requestedMs) <= SCENE_NAVIGATION_NEAREST_MAX_ERROR_MS) {
    return nearest;
  }
  return anchorSceneMarkerTimeMs(requestedMs, markers);
}

export function resolveTimelineSceneMarkers(
  playbackMarkers: PlaybackSceneNavigationMarker[],
  contentSceneMarkers: PlaybackSceneNavigationMarker[],
): PlaybackSceneNavigationMarker[] {
  if (playbackMarkers.length > 0) {
    return playbackMarkers;
  }

  return MarkerHelper.sortByIndex(
    contentSceneMarkers.map((marker) => MarkerHelper.normalizeMarker(marker)),
  );
}

export function isSnappedBackwardToSceneStart(params: {
  requestedMs: number;
  navigateTimeMs: number;
}): boolean {
  return (
    params.navigateTimeMs < params.requestedMs &&
    params.requestedMs - params.navigateTimeMs <= SCENE_NAVIGATION_SEGMENT_EDGE_SNAP_MS
  );
}
