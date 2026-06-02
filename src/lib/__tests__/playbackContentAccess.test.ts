import { describe, expect, it } from "vitest";
import {
  buildPlaybackV2StoryRenderSource,
  getPlaybackContentImages,
  getPlaybackContentManifest,
  getPlaybackContentSceneMarkers,
  getPlaybackContentStoryRenderSource,
  getPlaybackContentVoiceHoles,
  hasPlayableContentImages,
} from "@/lib/playbackContentAccess";
import type {
  PlaybackManifest,
  StoryAuthoringDocument,
} from "@/data/playbackV2Types";

function authoringDocument(): StoryAuthoringDocument {
  return {
    schemaVersion: "story-authoring.beat.mock.1",
    id: "authoring:test",
    storyStrip: {
      coordinate: "vertical-units",
      replaceImages: [],
      panels: [
        {
          id: "panel:image-2",
          order: 2,
          source: { uuid: "image-2", order: 2, src: "image-2.jpg", realname: "image-2.jpg" },
          layout: { topUnits: 1.5, heightUnits: 1.5, aspectRatio: "2 / 3" },
        },
        {
          id: "panel:image-1",
          order: 1,
          source: { uuid: "image-1", order: 1, src: "image-1.jpg", realname: "image-1.jpg" },
          layout: { topUnits: 0, heightUnits: 1.5, aspectRatio: "2 / 3" },
        },
      ],
      items: [
        {
          id: "inline-media-1",
          type: "video",
          order: 1.5,
          source: {
            provider: "youtube",
            src: "https://youtu.be/demo",
            embedUrl: "https://www.youtube.com/embed/demo",
            title: "demo video",
          },
          embedUrl: "https://www.youtube.com/embed/demo",
          placement: {
            afterImageOrder: 1,
            anchorImageOrder: 1,
            offsetRatio: 0.4,
          },
          layout: { heightUnits: 0.5625, aspectRatio: "16 / 9" },
        },
      ],
    },
    scenes: [],
    beats: [
      {
        id: "beat-voice",
        sceneId: "scene-1",
        order: 1,
        anchor: { panelId: "panel:image-1", ratioY: 0 },
        durationPolicy: "autoByVoice",
        minDurationMs: 500,
        voiceLines: [
          {
            id: "voice-line-1",
            characterId: "character-1",
            characterName: "나레이터",
            scriptLineId: "script-1",
            text: "첫 대사",
            assetId: "asset:voice-line-1",
            source: {
              src: "voice-1.mp3",
              artistNo: 7,
            },
            sourceDurationMs: 500,
            trimLeftMs: 0,
            trimRightMs: 0,
            volume: 1,
          },
        ],
        soundEffects: [],
        screenEffects: [],
        cameraIntent: {
          movement: "moveTo",
          target: { panelId: "panel:image-1", ratioY: 0 },
          easing: "linear",
          holdBeforeMs: 0,
          holdAfterMs: 0,
        },
      },
    ],
    assets: {
      images: [],
      audio: [],
      inlineMedia: [],
    },
  };
}

function playbackManifest(): PlaybackManifest {
  return {
    schemaVersion: "playback-manifest.beat.mock.1",
    id: "manifest:test",
    sourceDocumentId: "authoring:test",
    cameraPath: {
      coordinate: "viewportY",
      segments: [
        {
          startBeatId: "beat-1",
          endBeatId: "beat-2",
          startMs: 1200,
          endMs: 2200,
          fromY: 0.4,
          toY: 1.1,
          holdBeforeMs: 0,
          holdAfterMs: 0,
          easing: "linear",
        },
      ],
      keyframes: [
        {
          id: "camera-1",
          beatId: "beat-1",
          timeMs: 1200,
          viewportY: 0.4,
          positionRatio: 20,
          top: 184,
          holdBeforeMs: 0,
          holdAfterMs: 0,
        },
        {
          id: "camera-2",
          beatId: "beat-2",
          timeMs: 2200,
          viewportY: 1.1,
          positionRatio: 55,
          top: 506,
          holdBeforeMs: 0,
          holdAfterMs: 0,
        },
      ],
    },
    audioCues: [
      {
        id: "audio:voice-line-1",
        type: "voice",
        beatId: "beat-voice",
        assetId: "asset:voice-line-1",
        trackId: "character-1",
        startMs: 1200,
        endMs: 1700,
        durationMs: 500,
        sourceStartMs: 0,
        sourceEndMs: 500,
        trimLeftMs: 0,
        trimRightMs: 0,
        volume: 1,
        sourceRef: { kind: "voice-line", id: "voice-line-1" },
        sources: [{ src: "voice-1.mp3", artistNo: 7 }],
      },
    ],
    visualCues: [
      {
        id: "visual:inline-media-1",
        type: "inline-media",
        beatId: "beat-1",
        startMs: 1200,
        endMs: 2200,
        durationMs: 1000,
        sourceRef: { kind: "inline-media", id: "inline-media-1" },
      },
    ],
    assetManifest: { images: [], audio: [], inlineMedia: [] },
    durationMs: 2200,
  };
}

describe("playbackContentAccess", () => {
  it("builds V2 render source from authoring document and manifest", () => {
    expect(
      buildPlaybackV2StoryRenderSource({
        authoringDocument: authoringDocument(),
        playbackManifest: playbackManifest(),
      }),
    ).toEqual({
      images: [
        { uuid: "image-1", order: 1, src: "image-1.jpg", realname: "image-1.jpg" },
        { uuid: "image-2", order: 2, src: "image-2.jpg", realname: "image-2.jpg" },
      ],
      inlineMedia: [
        {
          type: "youtube",
          mode: "inline",
          src: "https://youtu.be/demo",
          embedUrl: "https://www.youtube.com/embed/demo",
          title: "demo video",
          after_image_order: 1,
          start_ms: 1200,
          duration_ms: 1000,
          aspect_ratio: "16 / 9",
          render_image_order: 1,
          render_image_offset_ratio: 0.4,
        },
      ],
    });
  });

  it("resolves playable images from V2 content without top-level image compatibility", () => {
    const content = {
      format_version: "V2",
      authoring_document: authoringDocument(),
      playback_manifest: playbackManifest(),
    };

    expect(getPlaybackContentImages(content).map((image) => image.uuid)).toEqual([
      "image-1",
      "image-2",
    ]);
    expect(hasPlayableContentImages(content)).toBe(true);
  });

  it("resolves V2 story render source directly from runtime content", () => {
    const content = {
      format_version: "V2",
      authoring_document: authoringDocument(),
      playback_manifest: playbackManifest(),
    };

    expect(getPlaybackContentStoryRenderSource(content)?.images.map((image) => image.uuid)).toEqual([
      "image-1",
      "image-2",
    ]);
    expect(getPlaybackContentStoryRenderSource({ format_version: "V1" })).toBeNull();
  });

  it("resolves playback manifest from V2 runtime content", () => {
    const manifest = playbackManifest();
    const content = {
      format_version: "V2",
      authoring_document: authoringDocument(),
      playback_manifest: manifest,
    };

    expect(getPlaybackContentManifest(content)).toBe(manifest);
    expect(getPlaybackContentManifest({ format_version: "V1" })).toBeNull();
  });

  it("resolves scene markers from V2 camera keyframes without top-level spoint compatibility", () => {
    const content = {
      format_version: "V2",
      authoring_document: authoringDocument(),
      playback_manifest: playbackManifest(),
    };

    expect(getPlaybackContentSceneMarkers(content)).toEqual([
      {
        index: 0,
        time_ms: 1200,
        startMs: 1200,
        positionRatio: 20,
        top: 184,
      },
      {
        index: 1,
        time_ms: 2200,
        startMs: 2200,
        positionRatio: 55,
        top: 506,
      },
    ]);
  });

  it("resolves voice holes from V2 beats and audio cues without top-level tracks", () => {
    const content = {
      format_version: "V2",
      authoring_document: authoringDocument(),
      playback_manifest: playbackManifest(),
    };

    expect(getPlaybackContentVoiceHoles(content)).toEqual([
      {
        uuid: "voice-line-1",
        script_uuid: "script-1",
        start_ms: 1200,
        duration_ms: 500,
        script: "첫 대사",
        index: 1200,
        records: [{ src: "voice-1.mp3", artist_no: 7 }],
        character_uuid: "character-1",
        characterName: "나레이터",
      },
    ]);
  });
});
