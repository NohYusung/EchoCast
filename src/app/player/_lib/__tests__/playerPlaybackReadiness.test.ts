import { describe, expect, it } from "vitest";
import {
  resolvePlaybackAudioStartPolicy,
  resolvePlayerLoadingState,
  resolvePlayerPlaybackReadiness,
} from "@/app/player/_lib/playerPlaybackReadiness";

describe("playerPlaybackReadiness", () => {
  it("keeps the player in loading state while runtime resources are still loading", () => {
    expect(
      resolvePlayerLoadingState({
        isPreloading: false,
        isInitializing: false,
        resourceLoadingCount: 1,
        hasFinalLoadingError: false,
      }),
    ).toEqual({
      isLoading: true,
      shouldShowLoadingOverlay: true,
    });
  });

  it("does not allow playback until initialization, runtime resources, and store loading are all complete", () => {
    expect(
      resolvePlayerPlaybackReadiness({
        isInitializing: false,
        resourceLoadingCount: 1,
        playerStoreLoading: false,
      }),
    ).toEqual({
      isReady: false,
      reason: "runtime-resources-loading",
    });

    expect(
      resolvePlayerPlaybackReadiness({
        isInitializing: false,
        resourceLoadingCount: 0,
        playerStoreLoading: false,
      }),
    ).toEqual({
      isReady: true,
      reason: "ready",
    });
  });

  it("allows V2 camera playback to start when audio context is unavailable", () => {
    expect(
      resolvePlaybackAudioStartPolicy({
        isPlaybackV2Content: true,
        audioContextReady: false,
      }),
    ).toEqual({
      canStartPlayback: true,
      audioMode: "degraded",
      shouldNotifyAudioFailure: true,
    });

    expect(
      resolvePlaybackAudioStartPolicy({
        isPlaybackV2Content: false,
        audioContextReady: false,
      }),
    ).toEqual({
      canStartPlayback: false,
      audioMode: "degraded",
      shouldNotifyAudioFailure: true,
    });
  });
});
