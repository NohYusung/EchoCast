import type { PlaybackManifest } from "@/data/playbackV2Types";
import type { PlaybackContentAccessSource } from "@/lib/playbackContentAccess";
import {
  getPlaybackContentManifest,
} from "@/lib/playbackContentAccess";
import {
  getPlaybackAudioResourceRequests,
} from "@/lib/playbackV2/runtime";

export type PlaybackResourceReloadReason =
  | "manifest-audio"
  | "audio"
  | "voice"
  | "effects"
  | "markers";

export interface PlaybackResourceReloadPlan {
  needReload: boolean;
  reasons: PlaybackResourceReloadReason[];
  playbackManifest: PlaybackManifest | null;
}

export type PlaybackResourceReloadContent = PlaybackContentAccessSource & {
  tracks?: unknown;
  audio_tracks?: unknown;
  effects?: unknown;
  spoints?: unknown;
};

export interface PlaybackResourceReloadPlanParams {
  content: PlaybackResourceReloadContent | null;
  audioMode: "normal" | "degraded";
  voiceShockWaveCount: number;
  audioShockWaveCount: number;
  effectCount: number;
  markerCount: number;
}

function itemCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function getPlaybackResourceReloadPlan(
  params: PlaybackResourceReloadPlanParams,
): PlaybackResourceReloadPlan {
  const playbackManifest = getPlaybackContentManifest(params.content);
  const isAudioDegraded = params.audioMode === "degraded";
  const reasons: PlaybackResourceReloadReason[] = [];

  if (playbackManifest) {
    const audioRequestCount = getPlaybackAudioResourceRequests(playbackManifest).length;
    if (
      !isAudioDegraded &&
      audioRequestCount > 0 &&
      params.voiceShockWaveCount + params.audioShockWaveCount === 0
    ) {
      reasons.push("manifest-audio");
    }

    return {
      needReload: reasons.length > 0,
      reasons,
      playbackManifest,
    };
  }

  const legacyContent = params.content;

  if (
    !isAudioDegraded &&
    itemCount(legacyContent?.audio_tracks) > 0 &&
    params.audioShockWaveCount === 0
  ) {
    reasons.push("audio");
  }
  if (
    !isAudioDegraded &&
    itemCount(legacyContent?.tracks) > 0 &&
    params.voiceShockWaveCount === 0
  ) {
    reasons.push("voice");
  }
  if (itemCount(legacyContent?.effects) > 0 && params.effectCount === 0) {
    reasons.push("effects");
  }
  if (itemCount(legacyContent?.spoints) > 0 && params.markerCount === 0) {
    reasons.push("markers");
  }

  return {
    needReload: reasons.length > 0,
    reasons,
    playbackManifest: null,
  };
}
