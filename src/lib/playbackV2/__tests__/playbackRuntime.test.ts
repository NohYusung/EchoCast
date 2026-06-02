import { describe, expect, it } from "vitest";
import {
  createPlaybackTimelineIndex,
  migrateLegacyContentToPlaybackV2,
} from "@/lib/playbackV2";
import {
  advancePlayerClock,
  getPlaybackAudioResourceRequests,
  getAudioSchedulerWindow,
  getAudioSchedulePlaybackWindow,
  getDueVisualEffectCues,
  getPlaybackVisualEffectEvents,
  sampleCameraEngine,
} from "@/lib/playbackV2/runtime";
import type { VogopangContent } from "@/data/vogopangContentTypes";

function runtimeSampleContent(): VogopangContent {
  return {
    images: [
      { uuid: "image-1", order: 1, src: "images/1.jpg", realname: "1.jpg" },
      { uuid: "image-2", order: 2, src: "images/2.jpg", realname: "2.jpg" },
    ],
    replace_images: [],
    format_version: "V1",
    spoints: [
      {
        uuid: "camera-0",
        top: 0,
        time_ms: 0,
        transition_effect: { before_ms: 0, after_ms: 0 },
        positionRatio: 0,
      },
      {
        uuid: "camera-1",
        top: 460,
        time_ms: 1000,
        transition_effect: { before_ms: 0, after_ms: 0 },
        positionRatio: 100,
      },
    ],
    tracks: [
      {
        character_uuid: "character-1",
        character_name: "나레이터",
        holes: [
          {
            uuid: "hole-1",
            script_uuid: "script-1",
            start_ms: 1000,
            duration_ms: 500,
            script: "첫 대사",
            index: 1,
            records: [{ src: "voices/1.mp3", artist_no: 7 }],
          },
        ],
      },
    ],
    audio_tracks: [
      {
        uuid: "audio-track-1",
        clips: [
          {
            uuid: "clip-1",
            src: "sfx/door.mp3",
            start_ms: 500,
            duration_ms: 1000,
          },
        ],
      },
    ],
  };
}

describe("playback V2 runtime", () => {
  it("advances the PlayerClock from animation timestamps with speed and delta capping", () => {
    const first = advancePlayerClock({
      state: { currentTimeMs: 1000, lastTimestampMs: null },
      timestampMs: 2000,
      playSpeed: 2,
      maxDeltaMs: 100,
    });

    expect(first).toEqual({
      state: { currentTimeMs: 1000, lastTimestampMs: 2000 },
      deltaMs: 0,
      elapsedMs: 0,
      advanced: false,
    });

    const second = advancePlayerClock({
      state: first.state,
      timestampMs: 2300,
      playSpeed: 2,
      maxDeltaMs: 100,
    });

    expect(second).toEqual({
      state: { currentTimeMs: 1200, lastTimestampMs: 2300 },
      deltaMs: 100,
      elapsedMs: 200,
      advanced: true,
    });
  });

  it("samples CameraEngine from manifest cameraPath and lets inline media override the camera", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "runtime",
      legacyContent: runtimeSampleContent(),
    });
    const timelineIndex = createPlaybackTimelineIndex(envelope.playbackManifest);

    expect(
      sampleCameraEngine({
        timelineIndex,
        currentTimeMs: 500,
        metrics: {
          scrollHeight: 2000,
          viewportHeight: 500,
          currentScrollTop: 0,
        },
      }),
    ).toBe(750);

    expect(
      sampleCameraEngine({
        timelineIndex,
        currentTimeMs: 500,
        metrics: {
          scrollHeight: 2000,
          viewportHeight: 500,
          currentScrollTop: 0,
        },
        inlineMediaScrollTop: 333,
      }),
    ).toBe(333);
  });

  it("returns only unscheduled audio cues inside the AudioScheduler lookahead window", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "runtime",
      legacyContent: runtimeSampleContent(),
    });
    const timelineIndex = createPlaybackTimelineIndex(envelope.playbackManifest);
    const scheduledCueIds = new Set(["audio:sound:clip-1"]);

    const window = getAudioSchedulerWindow({
      timelineIndex,
      currentTimeMs: 750,
      lookaheadMs: 500,
      scheduledCueIds,
    });

    expect(window.map((item) => item.cue.id)).toEqual(["audio:voice:hole-1"]);
  });

  it("uses cue sourceStartMs/sourceEndMs when calculating the Web Audio source window", () => {
    const playbackWindow = getAudioSchedulePlaybackWindow({
      cue: {
        id: "audio:voice:character-a-line-1",
        type: "voice",
        beatId: "beat-1",
        assetId: "asset:voice:character-a",
        trackId: "character-a",
        startMs: 1000,
        endMs: 1600,
        durationMs: 600,
        sourceStartMs: 5000,
        sourceEndMs: 5600,
        trimLeftMs: 0,
        trimRightMs: 0,
        volume: 1,
        sourceRef: { kind: "voice-line", id: "voice-line-1" },
        sources: [{ src: "voices/character-a-merged.mp3", artistNo: 7 }],
      },
      delayMs: 0,
      offsetMs: 200,
      playDurationMs: 400,
    });

    expect(playbackWindow).toEqual({
      sourceOffsetMs: 5200,
      playDurationMs: 400,
    });
  });

  it("derives audio resource requests from the playback manifest instead of legacy tracks", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "runtime",
      legacyContent: runtimeSampleContent(),
    });

    expect(
      getPlaybackAudioResourceRequests(envelope.playbackManifest).map((request) => ({
        cueId: request.cueId,
        cueType: request.cueType,
        sourceRefId: request.sourceRefId,
        assetId: request.assetId,
        src: request.src,
      })),
    ).toEqual([
      {
        cueId: "audio:sound:clip-1",
        cueType: "sfx",
        sourceRefId: "sound:clip-1",
        assetId: "asset:sound:clip-1",
        src: "sfx/door.mp3",
      },
      {
        cueId: "audio:voice:hole-1",
        cueType: "voice",
        sourceRefId: "voice:hole-1",
        assetId: "asset:voice:hole-1",
        src: "voices/1.mp3",
      },
    ]);
  });

  it("returns due visual effect cues once using a cursor", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "runtime",
      legacyContent: runtimeSampleContent(),
    });
    const timelineIndex = createPlaybackTimelineIndex({
      ...envelope.playbackManifest,
      visualCues: [
        {
          id: "visual:flash",
          type: "effect",
          startMs: 300,
          endMs: 500,
          durationMs: 200,
          sourceRef: { kind: "effect", id: "flash" },
          params: { sub_type: "fade" },
        },
        {
          id: "visual:inline-media",
          type: "inline-media",
          startMs: 400,
          endMs: 700,
          durationMs: 300,
          sourceRef: { kind: "inline-media", id: "video-1" },
        },
        {
          id: "visual:shake",
          type: "effect",
          startMs: 900,
          endMs: 1000,
          durationMs: 100,
          sourceRef: { kind: "effect", id: "shake" },
          params: { sub_type: "shake" },
        },
      ],
    });

    const first = getDueVisualEffectCues({
      timelineIndex,
      currentTimeMs: 450,
      cursorIndex: 0,
    });

    expect(first.cues.map((cue) => cue.id)).toEqual(["visual:flash"]);
    expect(first.nextCursorIndex).toBe(2);

    const second = getDueVisualEffectCues({
      timelineIndex,
      currentTimeMs: 950,
      cursorIndex: first.nextCursorIndex,
    });

    expect(second.cues.map((cue) => cue.id)).toEqual(["visual:shake"]);
    expect(second.nextCursorIndex).toBe(3);
  });

  it("converts manifest visual effect cues into player effect events", () => {
    expect(
      getPlaybackVisualEffectEvents([
        {
          id: "visual:fade",
          type: "effect",
          beatId: "beat-1",
          startMs: 1200,
          endMs: 1700,
          durationMs: 500,
          sourceRef: { kind: "effect", id: "fade" },
          params: { sub_type: "fade", duration: 500 },
        },
        {
          id: "visual:inline-media",
          type: "inline-media",
          beatId: "beat-1",
          startMs: 1300,
          endMs: 1600,
          durationMs: 300,
          sourceRef: { kind: "inline-media", id: "video-1" },
        },
      ]),
    ).toEqual([
      {
        type: "effect",
        time_ms: 1200,
        params: { sub_type: "fade", duration: 500 },
      },
    ]);
  });
});
