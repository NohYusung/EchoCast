import { describe, expect, it } from "vitest";
import type { PlaybackManifest } from "@/data/playbackV2Types";
import { getPlaybackResourceReloadPlan } from "@/app/player/_lib/playbackResourceReload";

function playbackManifest(): PlaybackManifest {
  return {
    schemaVersion: "playback-manifest.beat.mock.1",
    id: "manifest:test",
    sourceDocumentId: "authoring:test",
    cameraPath: {
      coordinate: "viewportY",
      segments: [],
      keyframes: [],
    },
    audioCues: [
      {
        id: "audio:voice-1",
        type: "voice",
        beatId: "beat-1",
        assetId: "asset:voice-1",
        trackId: "character-1",
        startMs: 100,
        endMs: 600,
        durationMs: 500,
        sourceStartMs: 0,
        sourceEndMs: 500,
        trimLeftMs: 0,
        trimRightMs: 0,
        volume: 1,
        sourceRef: { kind: "voice-line", id: "voice-1" },
        sources: [{ src: "voice-1.mp3", artistNo: 7 }],
      },
    ],
    visualCues: [],
    assetManifest: { images: [], audio: [], inlineMedia: [] },
    durationMs: 600,
  };
}

describe("getPlaybackResourceReloadPlan", () => {
  it("reloads V2 playback from manifest audio instead of legacy fields", () => {
    expect(
      getPlaybackResourceReloadPlan({
        content: {
          format_version: "V2",
          authoring_document: null,
          playback_manifest: playbackManifest(),
        },
        audioMode: "normal",
        voiceShockWaveCount: 0,
        audioShockWaveCount: 0,
        effectCount: 0,
        markerCount: 0,
      }),
    ).toEqual({
      needReload: true,
      reasons: ["manifest-audio"],
      playbackManifest: playbackManifest(),
    });
  });

  it("does not reload V2 audio while audio is degraded", () => {
    expect(
      getPlaybackResourceReloadPlan({
        content: {
          format_version: "V2",
          authoring_document: null,
          playback_manifest: playbackManifest(),
        },
        audioMode: "degraded",
        voiceShockWaveCount: 0,
        audioShockWaveCount: 0,
        effectCount: 0,
        markerCount: 0,
      }).reasons,
    ).toEqual([]);
  });

  it("keeps legacy reload reasons isolated to legacy content", () => {
    expect(
      getPlaybackResourceReloadPlan({
        content: {
          format_version: "V1",
          tracks: [{ uuid: "track-1", holes: [{}] }],
          audio_tracks: [{ uuid: "audio-1", clips: [{}] }],
          effects: [{ time_ms: 100 }],
          spoints: [{ time_ms: 100 }],
        },
        audioMode: "normal",
        voiceShockWaveCount: 0,
        audioShockWaveCount: 0,
        effectCount: 0,
        markerCount: 0,
      }).reasons,
    ).toEqual(["audio", "voice", "effects", "markers"]);
  });
});
