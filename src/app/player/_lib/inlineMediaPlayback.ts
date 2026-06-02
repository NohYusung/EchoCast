import type { VogopangContentInlineMedia } from "@/data/vogopangContentTypes";

export type YouTubePlayerCommand = "mute" | "pauseVideo" | "playVideo";

export type InlineMediaScrollCenterParams = {
  mediaTop: number;
  mediaHeight: number;
  viewportHeight: number;
  maxScrollTop: number;
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mediaTimeMs(
  media: VogopangContentInlineMedia,
  snakeKey: "start_ms" | "duration_ms",
  camelKey: "startMs" | "durationMs",
): number | null {
  return finiteNumber(media[snakeKey] ?? media[camelKey]);
}

export function inlineMediaPlaybackKey(
  media: VogopangContentInlineMedia,
  index: number,
): string {
  return `${index}:${media.src}:${media.start_ms ?? ""}:${media.duration_ms ?? ""}`;
}

export function isInlineMediaActiveAtTime(
  media: VogopangContentInlineMedia,
  playbackTimeMs: number,
  isPlaying: boolean,
): boolean {
  if (!isPlaying) return false;
  const startMs = mediaTimeMs(media, "start_ms", "startMs");
  const durationMs = mediaTimeMs(media, "duration_ms", "durationMs");
  if (startMs == null || durationMs == null || durationMs <= 0) return false;
  return playbackTimeMs >= startMs && playbackTimeMs < startMs + durationMs;
}

export function buildYouTubePlayerCommandMessage(command: YouTubePlayerCommand): string {
  return JSON.stringify({
    event: "command",
    func: command,
    args: [],
  });
}

export function getCenteredInlineMediaScrollTop({
  mediaTop,
  mediaHeight,
  viewportHeight,
  maxScrollTop,
}: InlineMediaScrollCenterParams): number {
  const centeredScrollTop = mediaTop - (viewportHeight - mediaHeight) / 2;
  const boundedMaxScrollTop = Math.max(0, maxScrollTop);
  return Math.min(boundedMaxScrollTop, Math.max(0, centeredScrollTop));
}

export function buildYouTubeEmbedUrlWithOrigin(embedUrl: string, origin: string): string {
  try {
    const url = new URL(embedUrl);
    if (url.hostname.endsWith("youtube.com") && origin.trim()) {
      url.searchParams.set("origin", origin);
    }
    return url.toString();
  } catch {
    return embedUrl;
  }
}

export function buildYouTubeEmbedUrlForPlayback(
  embedUrl: string,
  origin: string | null,
  shouldAutoplay: boolean,
): string {
  const withOrigin = origin ? buildYouTubeEmbedUrlWithOrigin(embedUrl, origin) : embedUrl;
  if (!shouldAutoplay) return withOrigin;

  try {
    const url = new URL(withOrigin);
    if (url.hostname.endsWith("youtube.com")) {
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("mute", "1");
      url.searchParams.set("playsinline", "1");
    }
    return url.toString();
  } catch {
    return withOrigin;
  }
}

export function getYouTubeTargetOrigin(embedUrl: string): string {
  try {
    return new URL(embedUrl).origin;
  } catch {
    return "https://www.youtube.com";
  }
}
