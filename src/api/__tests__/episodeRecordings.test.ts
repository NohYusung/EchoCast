import { describe, expect, it } from "vitest";
import { collectHolesFromContent } from "@/api/episodeRecordings";
import { normalizeBackendPayload } from "@/lib/playerContentNormalize";
import { migrateLegacyContentToPlaybackV2 } from "@/lib/playbackV2";
import type { VogopangContent } from "@/data/vogopangContentTypes";

function legacyContentWithVoice(): VogopangContent {
  return {
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
            index: 1000,
            records: [{ src: "voice-1.mp3", artist_no: 7 }],
          },
        ],
      },
    ],
  };
}

describe("episodeRecordings", () => {
  it("collects V2 voice holes from authoring document and manifest without top-level tracks", () => {
    const envelope = migrateLegacyContentToPlaybackV2({
      playerKey: "recording-v2",
      legacyContent: legacyContentWithVoice(),
    });
    const { content } = normalizeBackendPayload(envelope);

    expect(content.tracks).toBeUndefined();
    expect(collectHolesFromContent(content)).toEqual([
      {
        uuid: "voice:hole-1",
        script_uuid: "script-1",
        start_ms: 1000,
        duration_ms: 500,
        script: "첫 대사",
        index: 1000,
        records: [{ src: "voice-1.mp3", artist_no: 7 }],
        character_uuid: "character-1",
        characterName: "나레이터",
      },
    ]);
  });
});
