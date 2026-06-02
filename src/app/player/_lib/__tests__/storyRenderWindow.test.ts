import { describe, expect, it } from "vitest";
import {
  buildPlaybackV2StoryRenderSource,
  buildVerticalStoryRenderItems,
  buildStoryItemRenderWindow,
  buildStoryRenderWindow,
} from "@/app/player/_lib/storyRenderWindow";
import type {
  PlaybackManifest,
  StoryAuthoringDocument,
} from "@/data/playbackV2Types";

describe("buildStoryRenderWindow", () => {
  it("returns only the story blocks near the current viewport", () => {
    const images = Array.from({ length: 100 }, (_, index) => ({
      uuid: `image-${index + 1}`,
    }));

    const renderWindow = buildStoryRenderWindow({
      images,
      imageHeightPx: 600,
      viewportTopPx: 12_000,
      viewportHeightPx: 900,
      overscanPx: 600,
      getImageKey: (image) => (image as { uuid: string }).uuid,
    });

    expect(renderWindow.totalHeightPx).toBe(60_000);
    expect(renderWindow.blocks.map((block) => block.imageIndex)).toEqual([19, 20, 21, 22]);
    expect(renderWindow.blocks.map((block) => block.key)).toEqual([
      "image-20",
      "image-21",
      "image-22",
      "image-23",
    ]);
    expect(renderWindow.blocks[0]).toMatchObject({
      topPx: 11_400,
      heightPx: 600,
    });
  });

  it("keeps the render window inside the story bounds", () => {
    const renderWindow = buildStoryRenderWindow({
      images: Array.from({ length: 3 }, (_, index) => ({ uuid: `image-${index}` })),
      imageHeightPx: 500,
      viewportTopPx: -300,
      viewportHeightPx: 800,
      overscanPx: 500,
    });

    expect(renderWindow.totalHeightPx).toBe(1500);
    expect(renderWindow.blocks.map((block) => block.imageIndex)).toEqual([0, 1, 2]);
    expect(renderWindow.blocks[0]?.topPx).toBe(0);
    expect(renderWindow.blocks.at(-1)?.topPx).toBe(1000);
  });
});

describe("buildStoryItemRenderWindow", () => {
  it("windows variable-height story items by cumulative vertical position", () => {
    const renderWindow = buildStoryItemRenderWindow({
      items: [
        { key: "image-1-top", payload: { kind: "image" }, heightPx: 300 },
        { key: "video-1", payload: { kind: "inline-media" }, heightPx: 225 },
        { key: "image-1-bottom", payload: { kind: "image" }, heightPx: 300 },
        { key: "image-2", payload: { kind: "image" }, heightPx: 600 },
      ],
      viewportTopPx: 320,
      viewportHeightPx: 420,
      overscanPx: 0,
    });

    expect(renderWindow.totalHeightPx).toBe(1425);
    expect(renderWindow.blocks.map((block) => block.key)).toEqual([
      "video-1",
      "image-1-bottom",
    ]);
    expect(renderWindow.blocks.map((block) => block.topPx)).toEqual([300, 525]);
    expect(renderWindow.blocks.map((block) => block.heightPx)).toEqual([225, 300]);
  });

  it("includes overscan without leaking outside the story bounds", () => {
    const renderWindow = buildStoryItemRenderWindow({
      items: [
        { key: "a", payload: null, heightPx: 100 },
        { key: "b", payload: null, heightPx: 200 },
        { key: "c", payload: null, heightPx: 300 },
      ],
      viewportTopPx: -500,
      viewportHeightPx: 120,
      overscanPx: 80,
    });

    expect(renderWindow.totalHeightPx).toBe(600);
    expect(renderWindow.blocks.map((block) => block.key)).toEqual(["a", "b"]);
    expect(renderWindow.blocks[0]?.topPx).toBe(0);
  });
});

describe("buildVerticalStoryRenderItems", () => {
  it("splits image blocks around inline media placement", () => {
    const items = buildVerticalStoryRenderItems({
      images: [
        { uuid: "image-1", order: 1 },
        { uuid: "image-2", order: 2 },
      ],
      inlineMedia: [
        {
          id: "video-1",
          render_image_order: 1,
          render_image_offset_ratio: 0.25,
          aspect_ratio: "16 / 9",
        },
      ],
      imageHeightPx: 600,
      inlineMediaWidthPx: 400,
      getImageKey: (image) => image.uuid,
      getImageOrder: (image) => image.order,
      getInlineMediaKey: (media) => media.id,
      getInlineMediaPlacement: (media) => ({
        imageOrder: media.render_image_order,
        offsetRatio: media.render_image_offset_ratio,
      }),
      getInlineMediaAspectRatio: (media) => media.aspect_ratio,
    });

    expect(items.map((item) => item.key)).toEqual([
      "image-1-segment-0",
      "video-1",
      "image-1-segment-end",
      "image-2-full",
    ]);
    expect(items.map((item) => item.heightPx)).toEqual([150, 225, 450, 600]);
    expect(items.map((item) => item.payload.kind)).toEqual([
      "image-segment",
      "inline-media",
      "image-segment",
      "image-segment",
    ]);
    expect(
      items
        .map((item) => item.payload)
        .filter((payload) => payload.kind === "image-segment")
        .map((payload) => payload.countedImage),
    ).toEqual([true, false, true]);
  });

  it("keeps plain image stories as one render item per image", () => {
    const items = buildVerticalStoryRenderItems({
      images: [{ uuid: "a" }, { uuid: "b" }],
      inlineMedia: [],
      imageHeightPx: 500,
      inlineMediaWidthPx: 320,
      getImageKey: (image) => image.uuid,
    });

    expect(items.map((item) => item.key)).toEqual(["a-full", "b-full"]);
    expect(items.map((item) => item.heightPx)).toEqual([500, 500]);
  });
});

describe("buildPlaybackV2StoryRenderSource", () => {
  it("builds viewer images and inline media from authoring document and manifest", () => {
    const authoringDocument: StoryAuthoringDocument = {
      schemaVersion: "story-authoring.beat.mock.1",
      id: "authoring:test",
      storyStrip: {
        coordinate: "vertical-units",
        replaceImages: [],
        panels: [
          {
            id: "panel:image-1",
            order: 1,
            source: { uuid: "image-1", order: 1, src: "image-1.jpg", realname: "image-1.jpg" },
            layout: { topUnits: 0, heightUnits: 1.5, aspectRatio: "2 / 3" },
          },
          {
            id: "panel:image-2",
            order: 2,
            source: { uuid: "image-2", order: 2, src: "image-2.jpg", realname: "image-2.jpg" },
            layout: { topUnits: 1.5, heightUnits: 1.5, aspectRatio: "2 / 3" },
          },
        ],
        items: [
          {
            id: "story-image-1",
            type: "image",
            panelId: "panel:image-1",
            order: 1,
            source: { uuid: "image-1", order: 1, src: "image-1.jpg", realname: "image-1.jpg" },
            layout: { heightUnits: 1.5, aspectRatio: "2 / 3" },
          },
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
          {
            id: "story-image-2",
            type: "image",
            panelId: "panel:image-2",
            order: 2,
            source: { uuid: "image-2", order: 2, src: "image-2.jpg", realname: "image-2.jpg" },
            layout: { heightUnits: 1.5, aspectRatio: "2 / 3" },
          },
        ],
      },
      scenes: [],
      beats: [],
      assets: {
        images: [],
        audio: [],
        inlineMedia: [],
      },
    };
    const playbackManifest: PlaybackManifest = {
      schemaVersion: "playback-manifest.beat.mock.1",
      id: "manifest:test",
      sourceDocumentId: "authoring:test",
      cameraPath: { coordinate: "viewportY", segments: [], keyframes: [] },
      audioCues: [],
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

    expect(
      buildPlaybackV2StoryRenderSource({
        authoringDocument,
        playbackManifest,
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
});
