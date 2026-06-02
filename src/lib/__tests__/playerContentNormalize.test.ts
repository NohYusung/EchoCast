import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeBackendPayload } from "@/lib/playerContentNormalize";
import {
  buildPlaybackV2StoryRenderSource,
  getPlaybackContentImages,
} from "@/lib/playbackContentAccess";
import { migrateLegacyContentToPlaybackV2 } from "@/lib/playbackV2";
import type {
  PlayerRuntimeContent,
  VogopangContent,
} from "@/data/vogopangContentTypes";

function expectLegacyContent(content: PlayerRuntimeContent): asserts content is VogopangContent {
  expect(Array.isArray(content.tracks)).toBe(true);
  expect(Array.isArray(content.spoints)).toBe(true);
}

describe("playerContentNormalize", () => {
  it("loads a playback V2 envelope as authoring document and manifest content", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "v2-sample",
      legacyContent: {
        images: [{ uuid: "image-1", order: 1, src: "image.jpg", realname: "image.jpg" }],
        replace_images: [],
        format_version: "V1",
        spoints: [
          {
            uuid: "camera-1",
            top: 0,
            time_ms: 0,
            transition_effect: { before_ms: 0, after_ms: 0 },
            positionRatio: 0,
          },
        ],
        tracks: [],
        audio_tracks: [],
      },
    });

    const normalized = normalizeBackendPayload(envelope);

    expect(normalized.path).toBe("playback-v2");
    expect(normalized.content.format_version).toBe("V2");
    expect(normalized.content.playback_manifest?.id).toBe(envelope.playbackManifest.id);
    expect(normalized.content.images).toBeUndefined();
    expect(getPlaybackContentImages(normalized.content)[0].src).toBe("image.jpg");
  });

  it("preserves inline YouTube media as an embed item", () => {
    const { content } = normalizeBackendPayload({
      images: [{ uuid: "image-1", order: 1, src: "image.jpg", realname: "image.jpg" }],
      replace_images: [],
      format_version: "V1",
      spoints: [],
      tracks: [],
      inline_media: [
        {
          type: "youtube",
          mode: "inline",
          src: "https://youtu.be/lVve0_XJgQw?si=JOAIAi97xV4O4aks",
          after_image_order: 1,
        },
      ],
    });

    expect(content.inline_media).toEqual([
      {
        type: "youtube",
        mode: "inline",
        src: "https://youtu.be/lVve0_XJgQw?si=JOAIAi97xV4O4aks",
        embedUrl:
          "https://www.youtube.com/embed/lVve0_XJgQw?rel=0&playsinline=1&mute=1&enablejsapi=1",
        after_image_order: 1,
        aspect_ratio: "16 / 9",
      },
    ]);
  });

  it("applies inline media as a timeline and scroll spacer at the script visual anchor", () => {
    const { content } = normalizeBackendPayload({
      images: [
        { uuid: "image-1", order: 1, src: "image-1.jpg", realname: "image-1.jpg" },
        { uuid: "image-2", order: 2, src: "image-2.jpg", realname: "image-2.jpg" },
        { uuid: "image-3", order: 3, src: "image-3.jpg", realname: "image-3.jpg" },
        { uuid: "image-4", order: 4, src: "image-4.jpg", realname: "image-4.jpg" },
      ],
      replace_images: [],
      format_version: "V0",
      spoints: [
        {
          uuid: "spoint-before",
          index: 0,
          top: 0,
          time_ms: 0,
          startMs: 0,
          positionRatio: 0,
          transition_effect: { before_ms: 0, after_ms: 0 },
        },
        {
          uuid: "spoint-at-video-boundary",
          index: 1,
          top: 0,
          time_ms: 1000,
          startMs: 1000,
          positionRatio: 62.5,
          transition_effect: { before_ms: 0, after_ms: 0 },
        },
        {
          uuid: "spoint-after",
          index: 2,
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
              uuid: "hole-before",
              script_uuid: "script-before",
              start_ms: 750,
              duration_ms: 100,
              script: "before",
              index: 750,
              records: [],
            },
            {
              uuid: "hole-at-video-boundary",
              script_uuid: "script-at-video-boundary",
              start_ms: 1000,
              duration_ms: 100,
              script: "at boundary",
              index: 1000,
              records: [],
            },
            {
              uuid: "hole-after",
              script_uuid: "script-after",
              start_ms: 2000,
              duration_ms: 100,
              script: "after",
              index: 2000,
              records: [],
            },
          ],
        },
      ],
      audio_tracks: [
        {
          uuid: "audio-track-1",
          clips: [
            { src: "before.mp3", start_ms: 750, duration_ms: 100 },
            { src: "at.mp3", start_ms: 1000, duration_ms: 100 },
            { src: "after.mp3", start_ms: 2000, duration_ms: 100 },
          ],
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
    });

    expectLegacyContent(content);
    expect(content.inline_media?.[0]).toMatchObject({
      start_ms: 1000,
      duration_ms: 500,
      render_image_order: 3,
      render_image_offset_ratio: 0.5,
    });

    expectLegacyContent(content);
    const holes = content.tracks[0].holes;
    expect(holes.map((hole) => [hole.uuid, hole.start_ms, hole.index])).toEqual([
      ["hole-before", 750, 750],
      ["hole-at-video-boundary", 1500, 1500],
      ["hole-after", 2500, 2500],
    ]);

    expect(content.audio_tracks?.[0].clips?.map((clip) => clip.start_ms)).toEqual([
      750,
      1500,
      2500,
    ]);

    const videoStart = content.spoints.find((spoint) => spoint.uuid === "inline-media-0-start");
    const videoEnd = content.spoints.find((spoint) => spoint.uuid === "inline-media-0-end");
    const shiftedBoundary = content.spoints.find(
      (spoint) => spoint.uuid === "spoint-at-video-boundary",
    );

    expect(videoStart?.time_ms).toBe(1000);
    expect(videoEnd?.time_ms).toBe(1500);
    expect(videoStart?.positionRatio).toBeCloseTo(57.143, 3);
    expect(videoEnd?.positionRatio).toBeCloseTo(videoStart?.positionRatio ?? -1, 6);

    expect(shiftedBoundary?.time_ms).toBe(1500);
    expect(shiftedBoundary?.startMs).toBe(1500);
    expect(shiftedBoundary?.positionRatio).toBeCloseTo(65.714, 3);
  });

  it("moves voice holes that overlap the media start fully behind the media", () => {
    const { content } = normalizeBackendPayload({
      images: [
        { uuid: "image-1", order: 1, src: "image-1.jpg", realname: "image-1.jpg" },
        { uuid: "image-2", order: 2, src: "image-2.jpg", realname: "image-2.jpg" },
      ],
      replace_images: [],
      format_version: "V0",
      spoints: [
        {
          uuid: "spoint-before-overlap",
          index: 0,
          top: 0,
          time_ms: 950,
          startMs: 950,
          positionRatio: 40,
          transition_effect: { before_ms: 0, after_ms: 0 },
        },
        {
          uuid: "spoint-at-video",
          index: 1,
          top: 0,
          time_ms: 1000,
          startMs: 1000,
          positionRatio: 50,
          transition_effect: { before_ms: 0, after_ms: 0 },
        },
      ],
      tracks: [
        {
          character_uuid: "character-1",
          character_name: "캐릭터",
          holes: [
            {
              uuid: "hole-overlap",
              script_uuid: "script-overlap",
              start_ms: 900,
              duration_ms: 200,
              script: "overlaps media start",
              index: 900,
              records: [],
            },
            {
              uuid: "hole-after",
              script_uuid: "script-after",
              start_ms: 1200,
              duration_ms: 100,
              script: "after media start",
              index: 1200,
              records: [],
            },
          ],
        },
      ],
      inline_media: [
        {
          type: "youtube",
          mode: "inline",
          src: "https://youtu.be/lVve0_XJgQw?si=JOAIAi97xV4O4aks",
          after_image_order: 1,
          startMs: 1000,
          durationMs: 500,
        },
      ],
    });

    expectLegacyContent(content);
    const holes = content.tracks[0].holes;
    expect(holes.map((hole) => [hole.uuid, hole.start_ms, hole.index])).toEqual([
      ["hole-overlap", 1500, 1500],
      ["hole-after", 1800, 1800],
    ]);

    const shiftedEarlySpoint = content.spoints.find(
      (spoint) => spoint.uuid === "spoint-before-overlap",
    );
    expect(shiftedEarlySpoint?.time_ms).toBe(1550);
  });

  it("inserts the Samnyeon Pass video before the configured script", () => {
    const fixtureUrl = new URL(
      "../../../public/json/player/korean-folktales-comic-ep2.json",
      import.meta.url,
    );
    const { content } = normalizeBackendPayload(
      JSON.parse(readFileSync(fixtureUrl, "utf8")) as Record<string, unknown>,
    );

    const renderSource = buildPlaybackV2StoryRenderSource({
      authoringDocument: content.authoring_document,
      playbackManifest: content.playback_manifest,
    });

    expect(renderSource?.inlineMedia[0]).toMatchObject({
      start_ms: 124461,
      duration_ms: 15000,
      after_script_uuid: "ed0e8ccd-011b-43d6-a267-50f78aedb5dc",
      before_script_uuid: "5a85c849-247c-4073-bf70-1d5b86e1f510",
      render_image_order: 14,
    });
    expect(renderSource?.inlineMedia[0]?.render_image_offset_ratio).toBeCloseTo(0.709, 3);

    const videoCue = content.playback_manifest?.visualCues.find(
      (cue) => cue.sourceRef?.id === "inline-media-0",
    );
    expect(videoCue).toMatchObject({
      startMs: 124461,
      endMs: 139461,
      durationMs: 15000,
    });
    const videoCameraKeyframe = content.playback_manifest?.cameraPath.keyframes.find(
      (keyframe) => keyframe.timeMs === 124461,
    );
    expect(videoCameraKeyframe?.positionRatio).toBeCloseTo(50.0785, 4);

    const shiftedOverlapVoiceCue = content.playback_manifest?.audioCues.find(
      (cue) => cue.sourceRef.id === "voice:5a85c849-247c-4073-bf70-1d5b86e1f510",
    );
    const shiftedNextVoiceCue = content.playback_manifest?.audioCues.find(
      (cue) => cue.sourceRef.id === "voice:c41298cd-49de-4ae2-bc01-dbd9e68bab7b",
    );
    expect(shiftedOverlapVoiceCue?.startMs).toBe(139461);
    expect(shiftedNextVoiceCue?.startMs).toBe(141250);
  });
});
