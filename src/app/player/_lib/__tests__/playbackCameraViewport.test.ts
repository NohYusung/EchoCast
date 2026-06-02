import { describe, expect, it } from "vitest";
import {
  buildPlaybackCameraTransform,
  resolvePlaybackViewportTop,
} from "@/app/player/_lib/playbackCameraViewport";

describe("playbackCameraViewport", () => {
  it("uses camera position instead of DOM scroll while V2 playback is running", () => {
    expect(
      resolvePlaybackViewportTop({
        isPlaybackV2Content: true,
        isPlaying: true,
        cameraPositionPx: 1200,
        scrollTopPx: 300,
      }),
    ).toBe(1200);
  });

  it("falls back to DOM scroll when V2 camera playback is not active", () => {
    expect(
      resolvePlaybackViewportTop({
        isPlaybackV2Content: true,
        isPlaying: false,
        cameraPositionPx: 1200,
        scrollTopPx: 300,
      }),
    ).toBe(300);
    expect(
      resolvePlaybackViewportTop({
        isPlaybackV2Content: false,
        isPlaying: true,
        cameraPositionPx: 1200,
        scrollTopPx: 300,
      }),
    ).toBe(300);
  });

  it("returns a transform only for active V2 camera playback", () => {
    expect(
      buildPlaybackCameraTransform({
        isPlaybackV2Content: true,
        isPlaying: true,
        cameraPositionPx: 540.4,
      }),
    ).toBe("translate3d(0, -540.4px, 0)");
    expect(
      buildPlaybackCameraTransform({
        isPlaybackV2Content: true,
        isPlaying: false,
        cameraPositionPx: 540.4,
      }),
    ).toBeUndefined();
  });
});
