import { describe, expect, it } from "vitest";
import {
  buildYouTubeEmbedUrlForPlayback,
  buildYouTubePlayerCommandMessage,
  buildYouTubeEmbedUrlWithOrigin,
  getCenteredInlineMediaScrollTop,
  isInlineMediaActiveAtTime,
} from "@/app/player/_lib/inlineMediaPlayback";
import type { VogopangContentInlineMedia } from "@/data/vogopangContentTypes";

const media: VogopangContentInlineMedia = {
  type: "youtube",
  mode: "inline",
  src: "https://youtu.be/lVve0_XJgQw?si=JOAIAi97xV4O4aks",
  embedUrl: "https://www.youtube.com/embed/lVve0_XJgQw",
  after_image_order: 14,
  start_ms: 126013,
  duration_ms: 15000,
};

describe("inlineMediaPlayback", () => {
  it("detects whether playback time is inside an inline media segment", () => {
    expect(isInlineMediaActiveAtTime(media, 126012, true)).toBe(false);
    expect(isInlineMediaActiveAtTime(media, 126013, true)).toBe(true);
    expect(isInlineMediaActiveAtTime(media, 141012, true)).toBe(true);
    expect(isInlineMediaActiveAtTime(media, 141013, true)).toBe(false);
    expect(isInlineMediaActiveAtTime(media, 126013, false)).toBe(false);
  });

  it("detects active media when the source still has camelCase timing fields", () => {
    const rawMedia = {
      ...media,
      start_ms: undefined,
      duration_ms: undefined,
      startMs: 126013,
      durationMs: 15000,
    } as unknown as VogopangContentInlineMedia;

    expect(isInlineMediaActiveAtTime(rawMedia, 126013, true)).toBe(true);
    expect(isInlineMediaActiveAtTime(rawMedia, 141013, true)).toBe(false);
  });

  it("builds YouTube iframe API command messages", () => {
    expect(JSON.parse(buildYouTubePlayerCommandMessage("playVideo"))).toEqual({
      event: "command",
      func: "playVideo",
      args: [],
    });
    expect(JSON.parse(buildYouTubePlayerCommandMessage("pauseVideo"))).toEqual({
      event: "command",
      func: "pauseVideo",
      args: [],
    });
  });

  it("adds an origin parameter to YouTube embed URLs", () => {
    expect(
      buildYouTubeEmbedUrlWithOrigin(
        "https://www.youtube.com/embed/lVve0_XJgQw?rel=0&enablejsapi=1",
        "http://localhost:3000",
      ),
    ).toBe(
      "https://www.youtube.com/embed/lVve0_XJgQw?rel=0&enablejsapi=1&origin=http%3A%2F%2Flocalhost%3A3000",
    );
  });

  it("adds muted autoplay parameters only while inline media is active", () => {
    expect(
      buildYouTubeEmbedUrlForPlayback(
        "https://www.youtube.com/embed/lVve0_XJgQw?rel=0&enablejsapi=1",
        "http://localhost:3000",
        true,
      ),
    ).toBe(
      "https://www.youtube.com/embed/lVve0_XJgQw?rel=0&enablejsapi=1&origin=http%3A%2F%2Flocalhost%3A3000&autoplay=1&mute=1&playsinline=1",
    );

    expect(
      buildYouTubeEmbedUrlForPlayback(
        "https://www.youtube.com/embed/lVve0_XJgQw?rel=0&enablejsapi=1",
        "http://localhost:3000",
        false,
      ),
    ).toBe(
      "https://www.youtube.com/embed/lVve0_XJgQw?rel=0&enablejsapi=1&origin=http%3A%2F%2Flocalhost%3A3000",
    );
  });

  it("centers inline media within the viewport and clamps to scroll bounds", () => {
    expect(
      getCenteredInlineMediaScrollTop({
        mediaTop: 1000,
        mediaHeight: 300,
        viewportHeight: 800,
        maxScrollTop: 2000,
      }),
    ).toBe(750);

    expect(
      getCenteredInlineMediaScrollTop({
        mediaTop: 100,
        mediaHeight: 300,
        viewportHeight: 800,
        maxScrollTop: 2000,
      }),
    ).toBe(0);

    expect(
      getCenteredInlineMediaScrollTop({
        mediaTop: 2200,
        mediaHeight: 300,
        viewportHeight: 800,
        maxScrollTop: 1800,
      }),
    ).toBe(1800);
  });
});
