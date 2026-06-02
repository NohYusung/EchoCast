import { describe, expect, it } from "vitest";
import {
  adaptPlaybackV2EnvelopeToVogopangContent,
  compilePlaybackManifest,
  createPlaybackTimelineIndex,
  getAudioCueSchedule,
  migrateLegacyContentToPlaybackV2,
  sampleCameraPath,
} from "@/lib/playbackV2";
import { buildPlaybackV2EntitySnapshot } from "@/data/playbackV2Entities";
import type { VogopangContent } from "@/data/vogopangContentTypes";

function sampleLegacyContent(): VogopangContent {
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
        transition_effect: { before_ms: 100, after_ms: 100 },
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
            src: "sfx/door.mp3",
            start_ms: 500,
            duration_ms: 1000,
            trim_left_ms: 100,
            trim_right_ms: 0,
          },
        ],
      },
    ],
  };
}

describe("playbackV2 migration and runtime", () => {
  it("migrates legacy content into authoring document and playback manifest", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "sample",
      title: "샘플",
      legacyContent: sampleLegacyContent(),
    });

    expect(envelope.schemaVersion).toBe("playback-v2.beat.mock.1");
    expect(envelope.authoringDocument.storyStrip.panels.map((panel) => panel.id)).toEqual([
      "panel:image-1",
      "panel:image-2",
    ]);
    expect(envelope.authoringDocument.storyStrip.items.map((item) => item.type)).toEqual([
      "image",
      "image",
    ]);
    expect(envelope.authoringDocument.scenes).toEqual([
      {
        id: "scene:sample:main",
        title: "샘플",
        beatIds: ["beat:sample:0", "beat:sample:500", "beat:sample:1000"],
      },
    ]);
    expect(
      envelope.authoringDocument.beats.map((beat) => ({
        id: beat.id,
        anchor: beat.anchor,
        minDurationMs: beat.minDurationMs,
        voiceLines: beat.voiceLines.map((line) => line.id),
        soundEffects: beat.soundEffects.map((cue) => cue.id),
      })),
    ).toEqual([
      {
        id: "beat:sample:0",
        anchor: { panelId: "panel:image-1", ratioY: 0 },
        minDurationMs: 500,
        voiceLines: [],
        soundEffects: [],
      },
      {
        id: "beat:sample:500",
        anchor: { panelId: "panel:image-2", ratioY: 0 },
        minDurationMs: 500,
        voiceLines: [],
        soundEffects: ["sound:audio-track-1:clip-0"],
      },
      {
        id: "beat:sample:1000",
        anchor: { panelId: "panel:image-2", ratioY: 1 },
        minDurationMs: 500,
        voiceLines: ["voice:hole-1"],
        soundEffects: [],
      },
    ]);

    expect(envelope.playbackManifest.cameraPath.segments.map((segment) => segment.startMs)).toEqual([
      0,
      500,
      1000,
    ]);
    expect(envelope.playbackManifest.audioCues.map((cue) => [cue.type, cue.sourceRef.id])).toEqual([
      ["sfx", "sound:audio-track-1:clip-0"],
      ["voice", "voice:hole-1"],
    ]);
    expect(envelope.playbackManifest.assetManifest.images[0].src).toBe("images/1.jpg");
    expect(envelope.playbackManifest.durationMs).toBe(1500);
  });

  it("compiles a beat-centered authoring document into a playback manifest", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "sample",
      legacyContent: sampleLegacyContent(),
    });

    const manifest = compilePlaybackManifest({
      playerKey: "sample",
      authoringDocument: envelope.authoringDocument,
    });

    expect(manifest.sourceDocumentId).toBe(envelope.authoringDocument.id);
    expect(manifest.cameraPath.segments[1]).toMatchObject({
      startBeatId: "beat:sample:500",
      endBeatId: "beat:sample:1000",
      startMs: 500,
      endMs: 1000,
      fromY: 1.5,
      toY: 3,
      easing: "linear",
    });
    expect(manifest.audioCues).toEqual([
      expect.objectContaining({
        id: "audio:sound:audio-track-1:clip-0",
        type: "sfx",
        beatId: "beat:sample:500",
        assetId: "asset:sound:audio-track-1:clip-0",
        startMs: 500,
        endMs: 1500,
        sourceStartMs: 100,
        sourceEndMs: 1000,
      }),
      expect.objectContaining({
        id: "audio:voice:hole-1",
        type: "voice",
        beatId: "beat:sample:1000",
        assetId: "asset:voice:hole-1",
        startMs: 1000,
        endMs: 1500,
        sourceStartMs: 0,
        sourceEndMs: 500,
      }),
    ]);
  });

  it("can compile voice cues against one merged source asset per character", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "merged-voice",
      voiceAssetMode: "characterMerged",
      characterVoiceAssetBasePath: "/mock/character-voices",
      legacyContent: {
        images: [
          { uuid: "image-1", order: 1, src: "images/1.jpg", realname: "1.jpg" },
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
            top: 0,
            time_ms: 1000,
            transition_effect: { before_ms: 0, after_ms: 0 },
            positionRatio: 50,
          },
          {
            uuid: "camera-2",
            top: 0,
            time_ms: 2000,
            transition_effect: { before_ms: 0, after_ms: 0 },
            positionRatio: 100,
          },
        ],
        tracks: [
          {
            character_uuid: "character-a",
            character_name: "캐릭터 A",
            holes: [
              {
                uuid: "line-a-1",
                script_uuid: "script-a-1",
                start_ms: 0,
                duration_ms: 400,
                script: "첫 번째 대사",
                index: 0,
                records: [{ src: "voices/a-1.mp3", artist_no: 7 }],
              },
              {
                uuid: "line-a-2",
                script_uuid: "script-a-2",
                start_ms: 1000,
                duration_ms: 300,
                script: "두 번째 대사",
                index: 1000,
                records: [{ src: "voices/a-2.mp3", artist_no: 7 }],
              },
            ],
          },
          {
            character_uuid: "character-b",
            character_name: "캐릭터 B",
            holes: [
              {
                uuid: "line-b-1",
                script_uuid: "script-b-1",
                start_ms: 2000,
                duration_ms: 500,
                script: "다른 캐릭터 대사",
                index: 2000,
                records: [{ src: "voices/b-1.mp3", artist_no: 8 }],
              },
            ],
          },
        ],
        audio_tracks: [],
      },
    });

    expect(
      envelope.playbackManifest.assetManifest.audio.filter((asset) => asset.type === "voice"),
    ).toEqual([
      {
        id: "asset:voice-character:character-a",
        type: "voice",
        src: "/mock/character-voices/merged-voice/character-a.mp3",
        trackId: "character-a",
        sourceMode: "characterMerged",
        sourceLineIds: ["voice:line-a-1", "voice:line-a-2"],
        durationMs: 700,
      },
      {
        id: "asset:voice-character:character-b",
        type: "voice",
        src: "/mock/character-voices/merged-voice/character-b.mp3",
        trackId: "character-b",
        sourceMode: "characterMerged",
        sourceLineIds: ["voice:line-b-1"],
        durationMs: 500,
      },
    ]);
    expect(
      envelope.playbackManifest.audioCues
        .filter((cue) => cue.type === "voice")
        .map((cue) => ({
          sourceRefId: cue.sourceRef.id,
          assetId: cue.assetId,
          startMs: cue.startMs,
          sourceStartMs: cue.sourceStartMs,
          sourceEndMs: cue.sourceEndMs,
          src: cue.sources[0]?.src,
        })),
    ).toEqual([
      {
        sourceRefId: "voice:line-a-1",
        assetId: "asset:voice-character:character-a",
        startMs: 0,
        sourceStartMs: 0,
        sourceEndMs: 400,
        src: "/mock/character-voices/merged-voice/character-a.mp3",
      },
      {
        sourceRefId: "voice:line-a-2",
        assetId: "asset:voice-character:character-a",
        startMs: 1000,
        sourceStartMs: 400,
        sourceEndMs: 700,
        src: "/mock/character-voices/merged-voice/character-a.mp3",
      },
      {
        sourceRefId: "voice:line-b-1",
        assetId: "asset:voice-character:character-b",
        startMs: 2000,
        sourceStartMs: 0,
        sourceEndMs: 500,
        src: "/mock/character-voices/merged-voice/character-b.mp3",
      },
    ]);
  });

  it("samples camera path from the compiled index without sorting on each sample", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "sample",
      legacyContent: sampleLegacyContent(),
    });
    const timelineIndex = createPlaybackTimelineIndex(envelope.playbackManifest);

    expect(
      sampleCameraPath(timelineIndex.cameraPath, 50, {
        scrollHeight: 2000,
        viewportHeight: 500,
        currentScrollTop: 0,
      }),
    ).toBe(0);
    expect(
      sampleCameraPath(timelineIndex.cameraPath, 500, {
        scrollHeight: 2000,
        viewportHeight: 500,
        currentScrollTop: 0,
      }),
    ).toBe(750);
    expect(
      sampleCameraPath(timelineIndex.cameraPath, 950, {
        scrollHeight: 2000,
        viewportHeight: 500,
        currentScrollTop: 0,
      }),
    ).toBe(1425);
  });

  it("builds audio cue schedules relative to a seek time", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "sample",
      legacyContent: sampleLegacyContent(),
    });
    const timelineIndex = createPlaybackTimelineIndex(envelope.playbackManifest);

    const schedule = getAudioCueSchedule(timelineIndex, 750);

    expect(
      schedule.map((item) => ({
        id: item.cue.id,
        delayMs: item.delayMs,
        offsetMs: item.offsetMs,
        playDurationMs: item.playDurationMs,
      })),
    ).toEqual([
      {
        id: "audio:sound:audio-track-1:clip-0",
        delayMs: 0,
        offsetMs: 250,
        playDurationMs: 750,
      },
      {
        id: "audio:voice:hole-1",
        delayMs: 250,
        offsetMs: 0,
        playDurationMs: 500,
      },
    ]);
  });

  it("limits audio cue scheduling to the current lookahead window", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "sample",
      legacyContent: sampleLegacyContent(),
    });
    const timelineIndex = createPlaybackTimelineIndex(envelope.playbackManifest);

    const schedule = getAudioCueSchedule(timelineIndex, 750, 200);

    expect(schedule.map((item) => item.cue.id)).toEqual([
      "audio:sound:audio-track-1:clip-0",
    ]);
  });

  it("adapts a V2 envelope back to the current viewer shape with manifest attached", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "sample",
      legacyContent: sampleLegacyContent(),
    });

    const content = adaptPlaybackV2EnvelopeToVogopangContent(envelope);

    expect(content.format_version).toBe("V2");
    expect(content.images.map((image) => image.uuid)).toEqual(["image-1", "image-2"]);
    expect(content.spoints.map((spoint) => spoint.uuid)).toEqual([
      "camera:beat:sample:0",
      "camera:beat:sample:500",
      "camera:beat:sample:1000",
    ]);
    expect(content.tracks[0].holes[0].uuid).toBe("voice:hole-1");
    expect(content.audio_tracks?.[0].clips?.[0].uuid).toBe("sound:audio-track-1:clip-0");
    expect(content.playback_manifest?.id).toBe(envelope.playbackManifest.id);
  });

  it("compiles inline media into the V2 authoring document and playback manifest", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "inline-media-sample",
      legacyContent: {
        images: [
          { uuid: "image-1", order: 1, src: "image-1.jpg", realname: "image-1.jpg" },
          { uuid: "image-2", order: 2, src: "image-2.jpg", realname: "image-2.jpg" },
          { uuid: "image-3", order: 3, src: "image-3.jpg", realname: "image-3.jpg" },
          { uuid: "image-4", order: 4, src: "image-4.jpg", realname: "image-4.jpg" },
        ],
        replace_images: [],
        format_version: "V1",
        spoints: [
          {
            uuid: "spoint-before",
            top: 0,
            time_ms: 0,
            startMs: 0,
            positionRatio: 0,
            transition_effect: { before_ms: 0, after_ms: 0 },
          },
          {
            uuid: "spoint-video",
            top: 0,
            time_ms: 1000,
            startMs: 1000,
            positionRatio: 62.5,
            transition_effect: { before_ms: 0, after_ms: 0 },
          },
          {
            uuid: "spoint-after",
            top: 0,
            time_ms: 2000,
            startMs: 2000,
            positionRatio: 100,
            transition_effect: { before_ms: 0, after_ms: 0 },
          },
        ],
        tracks: [
          {
            character_uuid: "character-1",
            character_name: "캐릭터",
            holes: [
              {
                uuid: "hole-at-video-boundary",
                script_uuid: "script-at-video-boundary",
                start_ms: 1000,
                duration_ms: 100,
                script: "at boundary",
                index: 1000,
                records: [],
              },
            ],
          },
        ],
        audio_tracks: [
          {
            uuid: "audio-track-1",
            clips: [{ src: "at.mp3", start_ms: 1000, duration_ms: 100 }],
          },
        ],
        inline_media: [
          {
            type: "youtube",
            mode: "inline",
            src: "https://youtu.be/lVve0_XJgQw?si=JOAIAi97xV4O4aks",
            after_image_order: 2,
            startMs: 1000,
            durationMs: 500,
          },
        ],
      },
    });

    expect(envelope.authoringDocument.storyStrip.items.map((item) => item.type)).toEqual([
      "image",
      "image",
      "image",
      "video",
      "image",
    ]);

    const media = envelope.authoringDocument.storyStrip.items.find((item) => item.type === "video");
    expect(media).toMatchObject({
      id: "inline-media-0",
      type: "video",
      order: 3.5,
      source: {
        provider: "youtube",
        src: "https://youtu.be/lVve0_XJgQw?si=JOAIAi97xV4O4aks",
      },
      placement: {
        anchorImageOrder: 3,
        offsetRatio: 0.5,
      },
      layout: {
        aspectRatio: "16 / 9",
      },
    });
    expect(envelope.authoringDocument.storyStrip.inlineMedia).toBeUndefined();
    expect(
      envelope.authoringDocument.beats.flatMap((beat) =>
        beat.screenEffects.map((cue) => cue.sourceRef.id),
      ),
    ).toContain("inline-media-0");
    expect(envelope.playbackManifest.cameraPath.segments.map((segment) => segment.startBeatId)).toContain(
      "beat:inline-media-sample:1000",
    );
    expect(envelope.playbackManifest.audioCues.map((cue) => [cue.sourceRef.id, cue.startMs])).toEqual([
      ["sound:audio-track-1:clip-0", 1500],
      ["voice:hole-at-video-boundary", 1500],
    ]);

    const adapted = adaptPlaybackV2EnvelopeToVogopangContent(envelope);
    expect(adapted.inline_media?.[0]).toMatchObject({
      src: "https://youtu.be/lVve0_XJgQw?si=JOAIAi97xV4O4aks",
      start_ms: 1000,
      duration_ms: 500,
      render_image_order: 3,
      render_image_offset_ratio: 0.5,
    });
    expect(adapted.tracks[0].holes[0].start_ms).toBe(1500);
  });

  it("builds mock entities for checking the converted V2 data shape", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "entity-sample",
      legacyContent: {
        ...sampleLegacyContent(),
        inline_media: [
          {
            type: "youtube",
            mode: "inline",
            src: "https://youtu.be/lVve0_XJgQw",
            after_image_order: 1,
            startMs: 500,
            durationMs: 250,
          },
        ],
      },
    });

    const entity = buildPlaybackV2EntitySnapshot(envelope);

    expect(entity.document.id).toBe("authoring:entity-sample");
    expect(entity.storyStripItems.map((item) => [item.kind, item.itemId])).toEqual([
      ["image", "image-1"],
      ["video", "inline-media-0"],
      ["image", "image-2"],
    ]);
    expect(entity.storyStripItems[0]).toMatchObject({
      kind: "image",
      source: { type: "image", url: "images/1.jpg" },
      layout: { heightUnits: 1.5, aspectRatio: "2 / 3" },
    });
    expect(entity.storyStripItems.find((item) => item.kind === "video")).toMatchObject({
      kind: "video",
      playerKey: "entity-sample",
      source: {
        type: "youtube",
        url: "https://youtu.be/lVve0_XJgQw",
        embedUrl: "https://www.youtube.com/embed/lVve0_XJgQw?rel=0&playsinline=1&mute=1&enablejsapi=1",
      },
      placement: { anchorImageOrder: 2, offsetRatio: 0 },
      layout: { heightUnits: 0.5625, aspectRatio: "16 / 9" },
    });
    expect(entity.storyStripItems[0]).not.toHaveProperty("sourceUrl");
    expect(entity.storyStripItems.find((item) => item.kind === "video")).not.toHaveProperty(
      "timing",
    );
    expect(entity.beats.map((beat) => beat.beatId)).toEqual([
      "beat:entity-sample:0",
      "beat:entity-sample:500",
      "beat:entity-sample:750",
      "beat:entity-sample:1250",
    ]);
    expect(entity.playbackManifest.durationMs).toBe(envelope.playbackManifest.durationMs);
  });
});
