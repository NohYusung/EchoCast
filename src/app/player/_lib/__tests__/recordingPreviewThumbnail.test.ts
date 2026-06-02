import { describe, expect, it } from "vitest";
import type { VogopangContentImage } from "@/data/vogopangContentTypes";
import {
  resolveRecordingPreviewImage,
  resolveRecordingPreviewThumbnail,
  resolveRecordingPreviewThumbnailUrl,
} from "@/app/player/_lib/recordingPreviewThumbnail";

const images: VogopangContentImage[] = [
  { uuid: "image-1", order: 1, src: "/images/1.jpg", realname: "1.jpg" },
  { uuid: "image-2", order: 2, src: "/images/2.jpg", realname: "2.jpg" },
  { uuid: "image-3", order: 3, src: "/images/3.jpg", realname: "3.jpg" },
];

const sceneMarkers = [
  { time_ms: 0, positionRatio: 0, index: 0 },
  { time_ms: 1000, positionRatio: 50, index: 1 },
  { time_ms: 2000, positionRatio: 100, index: 2 },
];

describe("recordingPreviewThumbnail", () => {
  it("resolves preview image from scene markers without spoints", () => {
    expect(
      resolveRecordingPreviewImage(
        1250,
        {
          images,
          sceneMarkers,
        },
        "V0",
      ),
    ).toMatchObject({
      image: { uuid: "image-2" },
      index: 1,
    });
  });

  it("resolves thumbnail URL from scene markers without spoints", () => {
    expect(
      resolveRecordingPreviewThumbnailUrl(
        2000,
        {
          images,
          sceneMarkers,
        },
        "V0",
      ),
    ).toContain("/images/3.jpg");
  });

  it("resolves fallback thumbnail from scene markers without spoints", () => {
    expect(
      resolveRecordingPreviewThumbnail({
        holeStartMs: 1250,
        sceneMarkers,
        images,
        contentList: null,
        markers: [],
        version: "V0",
        targetScrollTop: null,
      }),
    ).toMatchObject({
      image: { uuid: "image-2" },
      index: 1,
      source: "data",
    });
  });
});
