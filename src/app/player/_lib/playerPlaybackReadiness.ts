export type PlayerPlaybackBlockedReason =
  | "initializing"
  | "runtime-resources-loading"
  | "store-loading"
  | "ready";

export interface PlayerLoadingStateInput {
  isPreloading: boolean;
  isInitializing: boolean;
  resourceLoadingCount: number;
  hasFinalLoadingError: boolean;
}

export interface PlayerPlaybackReadinessInput {
  isInitializing: boolean;
  resourceLoadingCount: number;
  playerStoreLoading: boolean;
}

export interface PlayerLoadingState {
  isLoading: boolean;
  shouldShowLoadingOverlay: boolean;
}

export interface PlayerPlaybackReadiness {
  isReady: boolean;
  reason: PlayerPlaybackBlockedReason;
}

export type PlaybackAudioMode = "enabled" | "degraded";

export interface PlaybackAudioStartPolicyInput {
  isPlaybackV2Content: boolean;
  audioContextReady: boolean;
}

export interface PlaybackAudioStartPolicy {
  canStartPlayback: boolean;
  audioMode: PlaybackAudioMode;
  shouldNotifyAudioFailure: boolean;
}

export function hasRuntimeResourcesLoading(resourceLoadingCount: number): boolean {
  return Number.isFinite(resourceLoadingCount) && resourceLoadingCount > 0;
}

export function resolvePlayerLoadingState(
  input: PlayerLoadingStateInput,
): PlayerLoadingState {
  const isLoading =
    input.isPreloading ||
    input.isInitializing ||
    hasRuntimeResourcesLoading(input.resourceLoadingCount);

  return {
    isLoading,
    shouldShowLoadingOverlay: isLoading && !input.hasFinalLoadingError,
  };
}

export function resolvePlayerPlaybackReadiness(
  input: PlayerPlaybackReadinessInput,
): PlayerPlaybackReadiness {
  if (input.isInitializing) {
    return { isReady: false, reason: "initializing" };
  }

  if (hasRuntimeResourcesLoading(input.resourceLoadingCount)) {
    return { isReady: false, reason: "runtime-resources-loading" };
  }

  if (input.playerStoreLoading) {
    return { isReady: false, reason: "store-loading" };
  }

  return { isReady: true, reason: "ready" };
}

export function resolvePlaybackAudioStartPolicy(
  input: PlaybackAudioStartPolicyInput,
): PlaybackAudioStartPolicy {
  if (input.audioContextReady) {
    return {
      canStartPlayback: true,
      audioMode: "enabled",
      shouldNotifyAudioFailure: false,
    };
  }

  return {
    canStartPlayback: input.isPlaybackV2Content,
    audioMode: "degraded",
    shouldNotifyAudioFailure: true,
  };
}
