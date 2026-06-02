import type {
  AudioCueScheduleItem,
  CameraPathSampleMetrics,
  PlaybackCueType,
  PlaybackManifest,
  PlaybackVisualCue,
  PlaybackTimelineIndex,
} from "@/data/playbackV2Types";
import {
  getAudioCueSchedule,
  sampleCameraPath,
} from "@/lib/playbackV2";

export interface PlayerClockState {
  currentTimeMs: number;
  lastTimestampMs: number | null;
}

export interface AdvancePlayerClockParams {
  state: PlayerClockState;
  timestampMs: number;
  playSpeed: number;
  maxDeltaMs?: number;
}

export interface AdvancePlayerClockResult {
  state: PlayerClockState;
  deltaMs: number;
  elapsedMs: number;
  advanced: boolean;
}

export interface SampleCameraEngineParams {
  timelineIndex: PlaybackTimelineIndex;
  currentTimeMs: number;
  metrics: CameraPathSampleMetrics;
  inlineMediaScrollTop?: number | null;
}

export interface AudioSchedulerWindowParams {
  timelineIndex: PlaybackTimelineIndex;
  currentTimeMs: number;
  lookaheadMs: number;
  scheduledCueIds?: Set<string>;
}

export interface AudioSchedulePlaybackWindow {
  sourceOffsetMs: number;
  playDurationMs: number;
}

export interface PlaybackAudioResourceRequest {
  cueId: string;
  cueType: PlaybackCueType;
  sourceRefId: string;
  assetId: string;
  trackId: string;
  src: string;
  startMs: number;
  durationMs: number;
  sourceStartMs: number;
  sourceEndMs: number;
  volume: number;
  effects?: unknown;
  artistNo?: number;
}

export interface VisualEffectSchedulerParams {
  timelineIndex: PlaybackTimelineIndex;
  currentTimeMs: number;
  cursorIndex: number;
}

export interface VisualEffectSchedulerResult {
  cues: PlaybackVisualCue[];
  nextCursorIndex: number;
}

export interface PlaybackVisualEffectEvent {
  type: "effect";
  time_ms: number;
  params?: unknown;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function advancePlayerClock(
  params: AdvancePlayerClockParams,
): AdvancePlayerClockResult {
  const currentTimeMs = finiteNonNegative(params.state.currentTimeMs);
  const timestampMs = finiteNonNegative(params.timestampMs);

  if (params.state.lastTimestampMs == null) {
    return {
      state: { currentTimeMs, lastTimestampMs: timestampMs },
      deltaMs: 0,
      elapsedMs: 0,
      advanced: false,
    };
  }

  const maxDeltaMs = finiteNonNegative(params.maxDeltaMs ?? 100);
  const rawDeltaMs = Math.max(0, timestampMs - params.state.lastTimestampMs);
  const deltaMs = Math.min(rawDeltaMs, maxDeltaMs);
  const playSpeed = Number.isFinite(params.playSpeed) ? Math.max(0, params.playSpeed) : 1;
  const elapsedMs = deltaMs * playSpeed;

  return {
    state: {
      currentTimeMs: currentTimeMs + elapsedMs,
      lastTimestampMs: timestampMs,
    },
    deltaMs,
    elapsedMs,
    advanced: deltaMs > 0,
  };
}

export function sampleCameraEngine(params: SampleCameraEngineParams): number {
  if (
    params.inlineMediaScrollTop != null &&
    Number.isFinite(params.inlineMediaScrollTop)
  ) {
    return finiteNonNegative(params.inlineMediaScrollTop);
  }

  return sampleCameraPath(
    params.timelineIndex.cameraPath,
    params.currentTimeMs,
    params.metrics,
  );
}

export function getAudioSchedulerWindow(
  params: AudioSchedulerWindowParams,
): AudioCueScheduleItem[] {
  return getAudioCueSchedule(
    params.timelineIndex,
    params.currentTimeMs,
    params.lookaheadMs,
  ).filter((item) => !params.scheduledCueIds?.has(item.cue.id));
}

export function getAudioSchedulePlaybackWindow(
  item: AudioCueScheduleItem,
): AudioSchedulePlaybackWindow {
  const sourceStartMs = finiteNonNegative(item.cue.sourceStartMs);
  const sourceEndMs = Math.max(
    sourceStartMs,
    finiteNonNegative(item.cue.sourceEndMs),
  );
  const sourceOffsetMs = Math.min(
    sourceEndMs,
    sourceStartMs + finiteNonNegative(item.offsetMs),
  );
  const remainingSourceMs = Math.max(0, sourceEndMs - sourceOffsetMs);

  return {
    sourceOffsetMs,
    playDurationMs: Math.min(
      finiteNonNegative(item.playDurationMs),
      remainingSourceMs,
    ),
  };
}

export function getPlaybackAudioResourceRequests(
  manifest: PlaybackManifest,
): PlaybackAudioResourceRequest[] {
  const assetSrcById = new Map(
    manifest.assetManifest.audio.map((asset) => [asset.id, asset.src]),
  );

  return manifest.audioCues
    .map((cue): PlaybackAudioResourceRequest | null => {
      const firstSource = cue.sources[0];
      const src = firstSource?.src ?? assetSrcById.get(cue.assetId) ?? "";
      if (!src) return null;

      return {
        cueId: cue.id,
        cueType: cue.type,
        sourceRefId: cue.sourceRef.id,
        assetId: cue.assetId,
        trackId: cue.trackId,
        src,
        startMs: finiteNonNegative(cue.startMs),
        durationMs: finiteNonNegative(cue.durationMs),
        sourceStartMs: finiteNonNegative(cue.sourceStartMs),
        sourceEndMs: finiteNonNegative(cue.sourceEndMs),
        volume: Number.isFinite(cue.volume) ? Math.max(0, cue.volume) : 1,
        effects: cue.effects,
        artistNo: firstSource?.artistNo,
      };
    })
    .filter((request): request is PlaybackAudioResourceRequest => request != null)
    .sort((a, b) => a.startMs - b.startMs || a.cueId.localeCompare(b.cueId));
}

export function getDueVisualEffectCues(
  params: VisualEffectSchedulerParams,
): VisualEffectSchedulerResult {
  const currentTimeMs = finiteNonNegative(params.currentTimeMs);
  let cursorIndex = Math.max(0, Math.floor(params.cursorIndex));
  const cues: PlaybackVisualCue[] = [];

  while (cursorIndex < params.timelineIndex.visualCues.length) {
    const cue = params.timelineIndex.visualCues[cursorIndex];
    if (!cue || cue.startMs > currentTimeMs) break;
    if (cue.type === "effect") {
      cues.push(cue);
    }
    cursorIndex += 1;
  }

  return {
    cues,
    nextCursorIndex: cursorIndex,
  };
}

export function getPlaybackVisualEffectEvents(
  cues: PlaybackVisualCue[],
): PlaybackVisualEffectEvent[] {
  return cues
    .filter((cue) => cue.type === "effect")
    .map((cue) => ({
      type: "effect",
      time_ms: finiteNonNegative(cue.startMs),
      params: cue.params,
    }));
}
