export const PLAYBACK_V2_CAMERA_POSITION_EVENT = "playback-v2-camera-position";

export interface PlaybackV2CameraPositionEventDetail {
  positionPx: number;
}

export interface PlaybackViewportTopParams {
  isPlaybackV2Content: boolean;
  isPlaying: boolean;
  cameraPositionPx: number;
  scrollTopPx: number;
}

export function normalizePlaybackCameraPosition(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function resolvePlaybackViewportTop(params: PlaybackViewportTopParams): number {
  if (params.isPlaybackV2Content && params.isPlaying) {
    return normalizePlaybackCameraPosition(params.cameraPositionPx);
  }
  return normalizePlaybackCameraPosition(params.scrollTopPx);
}

export function buildPlaybackCameraTransform(
  params: Omit<PlaybackViewportTopParams, "scrollTopPx">,
): string | undefined {
  if (!params.isPlaybackV2Content || !params.isPlaying) return undefined;
  return `translate3d(0, -${normalizePlaybackCameraPosition(params.cameraPositionPx)}px, 0)`;
}
