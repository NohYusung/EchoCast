/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  PlayerRuntimeContent,
  VogopangContent,
  VogopangContentImage,
  VogopangContentInlineMedia,
  VogopangContentSpoint,
  VogopangContentTrack,
} from "@/data/vogopangContentTypes";
import type { PlaybackV2Envelope } from "@/data/playbackV2Types";
import {
  adaptPlaybackV2EnvelopeToRuntimeContent,
  isPlaybackV2Envelope,
} from "@/lib/playbackV2";

export const ROUTE_VERSION = "normalize-v5-inline-media-timeline-2026-05-27";

export type PlayerContentPayload = PlayerRuntimeContent | PlaybackV2Envelope | Record<string, unknown>;

export type NormalizedContentMatch = { content: PlayerRuntimeContent; path: string };

/**
 * 작품 상세(`/works/:id`) 등에서 API `playerKey`가 없을 때 경로 세그먼트로 쓰는 토큰.
 * 로컬 `localJson/work.json`은 없으며, `seriesId`·`episodeId` 쿼리와 함께 백엔드 로드에 사용한다.
 */
export const WORKS_ENTRY_PLAYER_KEY = "work" as const;

/** lib localJson 파일명 = playerKey (path traversal 방지용 화이트리스트) */
export const ALLOWED_PLAYER_KEYS = [
  "three-kingdoms-ep0",
  "three-kingdoms-ep1",
  "three-kingdoms-ep2",
  "korean-folktales-comic-ep2",
  "korean-folktales-comic-ep3",
  "samguk-sagi-main-ep1",
  "samguk-sagi-main-ep2",
  "samguk-yusa-ep1",
  "samguk-yusa-ep2",
  "iliad-main-ep1",
  "iliad-main-ep2",
  WORKS_ENTRY_PLAYER_KEY,
] as const;

const SAFE_LOCAL_PLAYER_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const CARTOON_IMAGE_HEIGHT_UNITS = 1.5;
const CARTOON_BASE_WIDTH_PX = 460;
const DEFAULT_INLINE_MEDIA_ASPECT_RATIO = "16 / 9";
const DEFAULT_INLINE_MEDIA_HEIGHT_UNITS = 9 / 16;
const INLINE_MEDIA_VISUAL_MARKER_WINDOW_MS = 250;

export function isAllowedPlayerKey(key: string): key is (typeof ALLOWED_PLAYER_KEYS)[number] {
  return key === WORKS_ENTRY_PLAYER_KEY || SAFE_LOCAL_PLAYER_KEY_PATTERN.test(key.trim());
}

/** API에서 온 playerKey가 화이트에 있으면 그대로, 아니면 작품 진입용 키로 통일 */
export function resolvePlayerPathSegment(playerKey: string | undefined | null): string {
  const k = playerKey?.trim();
  if (k && isAllowedPlayerKey(k)) return k;
  return WORKS_ENTRY_PLAYER_KEY;
}

function isNormalizedContent(value: unknown): value is VogopangContent {
  const content = value as Partial<VogopangContent> | null;
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray(content?.images),
  );
}

function getYouTubeVideoId(src: string): string | null {
  try {
    const url = new URL(src);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }
      const embedMatch = url.pathname.match(/^\/embed\/([^/?#]+)/);
      return embedMatch?.[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function toYouTubeEmbedUrl(src: string): string | null {
  const id = getYouTubeVideoId(src);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?rel=0&playsinline=1&mute=1&enablejsapi=1`;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function mediaMsValue(
  record: Record<string, unknown>,
  snakeKey: string,
  camelKey: string,
): number | undefined {
  return finiteNumber(record[snakeKey] ?? record[camelKey]);
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseAspectRatioHeightUnits(value: string | undefined): number {
  const raw = value?.trim();
  if (!raw) return DEFAULT_INLINE_MEDIA_HEIGHT_UNITS;

  const ratioMatch = raw.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (ratioMatch) {
    const width = Number(ratioMatch[1]);
    const height = Number(ratioMatch[2]);
    if (width > 0 && height > 0) {
      return height / width;
    }
  }

  const numericRatio = Number(raw);
  if (Number.isFinite(numericRatio) && numericRatio > 0) {
    return 1 / numericRatio;
  }

  return DEFAULT_INLINE_MEDIA_HEIGHT_UNITS;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function markerTimeMs(spoint: VogopangContentSpoint): number {
  return finiteNumber(spoint.time_ms) ?? finiteNumber(spoint.startMs) ?? 0;
}

function markerPositionRatio(spoint: VogopangContentSpoint): number | undefined {
  return finiteNumber(spoint.positionRatio);
}

function hasMeaningfulTopSpread(spoints: VogopangContentSpoint[]): boolean {
  const tops = spoints
    .map((spoint) => finiteNumber(spoint.top))
    .filter((top): top is number => typeof top === "number");
  if (tops.length < 2) return false;
  return Math.max(...tops) - Math.min(...tops) > 0.5;
}

function resolvePositionRatioAtTime(
  spoints: VogopangContentSpoint[],
  startMs: number,
): number | undefined {
  const markers = spoints
    .map((spoint) => ({
      timeMs: markerTimeMs(spoint),
      positionRatio: markerPositionRatio(spoint),
    }))
    .filter(
      (marker): marker is { timeMs: number; positionRatio: number } =>
        marker.positionRatio != null && Number.isFinite(marker.timeMs),
    )
    .sort((a, b) => a.timeMs - b.timeMs);

  if (markers.length === 0) return undefined;

  const nextCloseMarker = markers.find(
    (marker) =>
      marker.timeMs >= startMs &&
      marker.timeMs - startMs <= INLINE_MEDIA_VISUAL_MARKER_WINDOW_MS,
  );
  if (nextCloseMarker) return nextCloseMarker.positionRatio;

  if (startMs <= markers[0].timeMs) return markers[0].positionRatio;
  const last = markers[markers.length - 1];
  if (startMs >= last.timeMs) return last.positionRatio;

  for (let index = 0; index < markers.length - 1; index++) {
    const current = markers[index];
    const next = markers[index + 1];
    if (startMs < current.timeMs || startMs > next.timeMs) continue;
    const durationMs = next.timeMs - current.timeMs;
    if (durationMs <= 0) return current.positionRatio;
    const progress = (startMs - current.timeMs) / durationMs;
    return current.positionRatio + (next.positionRatio - current.positionRatio) * progress;
  }

  return undefined;
}

function resolveInlineMediaRenderPlacement(
  imageCount: number,
  visualPositionUnits: number,
): Pick<VogopangContentInlineMedia, "render_image_order" | "render_image_offset_ratio"> {
  const maxImageUnits = Math.max(0, imageCount * CARTOON_IMAGE_HEIGHT_UNITS);
  if (imageCount <= 0 || maxImageUnits <= 0) {
    return { render_image_order: 1, render_image_offset_ratio: 0 };
  }

  const clampedUnits = Math.min(maxImageUnits, Math.max(0, visualPositionUnits));
  if (clampedUnits >= maxImageUnits) {
    return { render_image_order: imageCount, render_image_offset_ratio: 1 };
  }

  const zeroBasedImageIndex = Math.floor(clampedUnits / CARTOON_IMAGE_HEIGHT_UNITS);
  const renderImageOrder = Math.min(imageCount, zeroBasedImageIndex + 1);
  const imageStartUnits = zeroBasedImageIndex * CARTOON_IMAGE_HEIGHT_UNITS;
  const offsetRatio = (clampedUnits - imageStartUnits) / CARTOON_IMAGE_HEIGHT_UNITS;

  return {
    render_image_order: renderImageOrder,
    render_image_offset_ratio: Math.min(1, Math.max(0, offsetRatio)),
  };
}

function resolveInlineMediaStartMs(
  content: VogopangContent,
  media: VogopangContentInlineMedia,
): number | undefined {
  const explicitStartMs = finiteNumber(media.start_ms);
  if (explicitStartMs != null) {
    return explicitStartMs;
  }

  const holes = content.tracks.flatMap((track) => track.holes);
  if (media.before_script_uuid) {
    const beforeHole = holes.find(
      (hole) =>
        hole.script_uuid === media.before_script_uuid || hole.uuid === media.before_script_uuid,
    );
    if (beforeHole) return beforeHole.start_ms;
  }

  if (media.after_script_uuid) {
    const afterHole = holes.find(
      (hole) =>
        hole.script_uuid === media.after_script_uuid || hole.uuid === media.after_script_uuid,
    );
    if (afterHole) return afterHole.start_ms + afterHole.duration_ms;
  }

  return undefined;
}

function applyInlineMediaTimeline(content: VogopangContent): VogopangContent {
  const mediaItems = content.inline_media ?? [];
  if (mediaItems.length === 0) return content;

  return mediaItems.reduce((currentContent, media, mediaIndex) => {
    const currentMedia = currentContent.inline_media?.[mediaIndex] ?? media;
    const startMs = resolveInlineMediaStartMs(currentContent, currentMedia);
    const durationMs = finiteNumber(currentMedia.duration_ms);
    if (
      startMs == null ||
      durationMs == null ||
      durationMs <= 0 ||
      !Number.isFinite(currentMedia.after_image_order)
    ) {
      return currentContent;
    }

    const previousMediaItems = (currentContent.inline_media ?? []).slice(0, mediaIndex);
    const previousValidMediaItems = previousMediaItems.filter((previousMedia) => {
      const previousDurationMs = finiteNumber(previousMedia.duration_ms);
      const previousStartMs = finiteNumber(previousMedia.start_ms);
      return previousStartMs != null && previousDurationMs != null && previousDurationMs > 0;
    });
    const mediaHeightUnits = parseAspectRatioHeightUnits(currentMedia.aspect_ratio);
    const oldStripHeightUnits =
      currentContent.images.length * CARTOON_IMAGE_HEIGHT_UNITS +
      previousValidMediaItems.reduce(
        (sum, previousMedia) => sum + parseAspectRatioHeightUnits(previousMedia.aspect_ratio),
        0,
      );
    const newStripHeightUnits = oldStripHeightUnits + mediaHeightUnits;
    const previousVisualHeightBeforeInsert = previousValidMediaItems
      .filter((previousMedia) => previousMedia.after_image_order <= currentMedia.after_image_order)
      .reduce(
        (sum, previousMedia) => sum + parseAspectRatioHeightUnits(previousMedia.aspect_ratio),
        0,
      );
    const fallbackInsertPositionUnits =
      currentMedia.after_image_order * CARTOON_IMAGE_HEIGHT_UNITS +
      previousVisualHeightBeforeInsert;
    const visualPositionRatio = resolvePositionRatioAtTime(currentContent.spoints, startMs);
    const insertPositionUnits =
      visualPositionRatio != null
        ? (clampRatio(visualPositionRatio) / 100) * oldStripHeightUnits
        : fallbackInsertPositionUnits;
    const renderPlacement = resolveInlineMediaRenderPlacement(
      currentContent.images.length,
      insertPositionUnits - previousVisualHeightBeforeInsert,
    );
    const videoStartRatio = clampRatio((insertPositionUnits / newStripHeightUnits) * 100);
    const topMappingHasSpread = hasMeaningfulTopSpread(currentContent.spoints);
    const mediaTopPx = mediaHeightUnits * CARTOON_BASE_WIDTH_PX;
    const insertTopPx = insertPositionUnits * CARTOON_BASE_WIDTH_PX;
    const overlappingHoleStartMsList = currentContent.tracks
      .flatMap((track) => track.holes)
      .map((hole) => {
        const holeStartMs = finiteNumber(hole.start_ms);
        const holeDurationMs = finiteNumber(hole.duration_ms) ?? 0;
        if (holeStartMs == null || holeDurationMs <= 0) return undefined;
        const holeEndMs = holeStartMs + holeDurationMs;
        return holeStartMs < startMs && holeEndMs > startMs ? holeStartMs : undefined;
      })
      .filter((holeStartMs): holeStartMs is number => holeStartMs != null);
    const shiftFromMs =
      overlappingHoleStartMsList.length > 0
        ? Math.min(startMs, ...overlappingHoleStartMsList)
        : startMs;
    const shiftDeltaMs = durationMs + (startMs - shiftFromMs);

    const shiftedTracks = currentContent.tracks.map((track) => ({
      ...track,
      holes: track.holes.map((hole) => {
        if (hole.start_ms < shiftFromMs) return hole;
        const shiftedStartMs = hole.start_ms + shiftDeltaMs;
        return {
          ...hole,
          start_ms: shiftedStartMs,
          index:
            typeof hole.index === "number" && Number.isFinite(hole.index)
              ? hole.index + shiftDeltaMs
              : hole.index,
        };
      }),
    }));

    const shiftedAudioTracks = currentContent.audio_tracks?.map((track) => ({
      ...track,
      clips: track.clips?.map((clip) => {
        const clipStartMs = finiteNumber(clip.start_ms);
        if (clipStartMs == null || clipStartMs < shiftFromMs) return clip;
        return { ...clip, start_ms: clipStartMs + shiftDeltaMs };
      }),
    }));

    const shiftedSpoints = currentContent.spoints.map((spoint) => {
      const oldTimeMs = markerTimeMs(spoint);
      const shouldShift = oldTimeMs >= shiftFromMs;
      const shiftedTimeMs = shouldShift ? oldTimeMs + shiftDeltaMs : oldTimeMs;
      const oldPositionRatio = finiteNumber(spoint.positionRatio) ?? 0;
      const oldPositionUnits = (clampRatio(oldPositionRatio) / 100) * oldStripHeightUnits;
      const newPositionUnits =
        shouldShift ? oldPositionUnits + mediaHeightUnits : oldPositionUnits;
      const oldTop = finiteNumber(spoint.top) ?? 0;

      return {
        ...spoint,
        top: topMappingHasSpread && shouldShift ? oldTop + mediaTopPx : oldTop,
        time_ms: shiftedTimeMs,
        startMs: shiftedTimeMs,
        positionRatio: clampRatio((newPositionUnits / newStripHeightUnits) * 100),
      };
    });

    const mediaStartMarker: VogopangContentSpoint = {
      uuid: `inline-media-${mediaIndex}-start`,
      top: topMappingHasSpread ? insertTopPx : 0,
      time_ms: startMs,
      startMs,
      transition_effect: { before_ms: 0, after_ms: 0 },
      positionRatio: videoStartRatio,
    };
    const mediaEndMarker: VogopangContentSpoint = {
      uuid: `inline-media-${mediaIndex}-end`,
      top: topMappingHasSpread ? insertTopPx : 0,
      time_ms: startMs + durationMs,
      startMs: startMs + durationMs,
      transition_effect: { before_ms: 0, after_ms: 0 },
      positionRatio: videoStartRatio,
    };

    const spoints = [...shiftedSpoints, mediaStartMarker, mediaEndMarker]
      .sort((a, b) => {
        const timeDelta = markerTimeMs(a) - markerTimeMs(b);
        if (Math.abs(timeDelta) > 1e-9) return timeDelta;
        return (a.positionRatio ?? 0) - (b.positionRatio ?? 0);
      })
      .map((spoint, index) => ({ ...spoint, index }));
    const inlineMedia = currentContent.inline_media?.map((item, index) => {
      if (index === mediaIndex) {
        return {
          ...item,
          start_ms: startMs,
          duration_ms: durationMs,
          ...renderPlacement,
        };
      }
      const itemStartMs = finiteNumber(item.start_ms);
      if (itemStartMs != null && itemStartMs >= shiftFromMs) {
        return { ...item, start_ms: itemStartMs + shiftDeltaMs };
      }
      return item;
    });

    return {
      ...currentContent,
      spoints,
      tracks: shiftedTracks,
      ...(inlineMedia ? { inline_media: inlineMedia } : {}),
      ...(shiftedAudioTracks ? { audio_tracks: shiftedAudioTracks } : {}),
    };
  }, content);
}

function normalizeInlineMediaItems(value: unknown): VogopangContentInlineMedia[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const items = value.flatMap((item): VogopangContentInlineMedia[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const src = typeof record.src === "string" ? record.src.trim() : "";
    const embedUrl = toYouTubeEmbedUrl(src);
    const afterImageOrder = Number(record.after_image_order);

    if (!src || !embedUrl || !Number.isFinite(afterImageOrder)) {
      return [];
    }

    const startMs = mediaMsValue(record, "start_ms", "startMs");
    const durationMs = mediaMsValue(record, "duration_ms", "durationMs");
    const afterScriptUuid = textValue(record.after_script_uuid ?? record.afterScriptUuid);
    const beforeScriptUuid = textValue(record.before_script_uuid ?? record.beforeScriptUuid);

    return [
      {
        type: "youtube",
        mode: "inline",
        src,
        embedUrl,
        after_image_order: afterImageOrder,
        aspect_ratio:
          typeof record.aspect_ratio === "string" && record.aspect_ratio.trim()
            ? record.aspect_ratio.trim()
            : DEFAULT_INLINE_MEDIA_ASPECT_RATIO,
        ...(startMs != null && startMs >= 0 ? { start_ms: startMs } : {}),
        ...(durationMs != null && durationMs > 0 ? { duration_ms: durationMs } : {}),
        ...(afterScriptUuid ? { after_script_uuid: afterScriptUuid } : {}),
        ...(beforeScriptUuid ? { before_script_uuid: beforeScriptUuid } : {}),
        ...(typeof record.title === "string" && record.title.trim()
          ? { title: record.title.trim() }
          : {}),
      },
    ];
  });

  return items.length > 0 ? items : undefined;
}

function coerceNormalizedContent(value: Record<string, unknown>): VogopangContent {
  const inline_media = normalizeInlineMediaItems(value.inline_media);

  return applyInlineMediaTimeline({
    images: Array.isArray(value.images) ? (value.images as VogopangContent["images"]) : [],
    replace_images: Array.isArray(value.replace_images) ? value.replace_images : [],
    format_version:
      typeof value.format_version === "string" ? value.format_version : "V1",
    spoints: Array.isArray(value.spoints) ? (value.spoints as VogopangContent["spoints"]) : [],
    tracks: Array.isArray(value.tracks) ? (value.tracks as VogopangContent["tracks"]) : [],
    ...(Array.isArray(value.audio_tracks) ? { audio_tracks: value.audio_tracks } : {}),
    ...(inline_media ? { inline_media } : {}),
  });
}

function findNormalizedContent(
  value: unknown,
  path = "root",
  seen = new WeakSet<object>(),
): NormalizedContentMatch | null {
  if (typeof value === "string") {
    try {
      return findNormalizedContent(JSON.parse(value), `${path}<json>`, seen);
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findNormalizedContent(item, `${path}[${index}]`, seen);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (seen.has(record)) {
    return null;
  }
  seen.add(record);

  if (isNormalizedContent(record)) {
    return { content: coerceNormalizedContent(record), path };
  }

  const nestedCandidates = [
    ["data", record.data],
    ["result", record.result],
    ["episode", record.episode],
    ["content", record.content],
    ["playerInfo", record.playerInfo],
    ["payload", record.payload],
  ];

  for (const [key, candidate] of nestedCandidates) {
    const found = findNormalizedContent(candidate, `${path}.${key}`, seen);
    if (found) {
      return found;
    }
  }

  for (const [key, candidate] of Object.entries(record)) {
    const isCommonWrapperKey = nestedCandidates.some(([wrapperKey]) => wrapperKey === key);
    if (isCommonWrapperKey) {
      continue;
    }

    const found = findNormalizedContent(candidate, `${path}.${key}`, seen);
    if (found) {
      return found;
    }
  }

  return null;
}

export function mapLibEpisodeToVogopangContent(rawJson: unknown): VogopangContent {
  const episode = (rawJson as any)?.data?.episode;
  if (!episode?.content) {
    throw new Error("Invalid lib JSON: missing data.episode.content");
  }

  const inner =
    typeof episode.content === "string" ? JSON.parse(episode.content) : episode.content;

  const images: VogopangContentImage[] = (inner.images ?? []).map((i: any) => ({
    uuid: String(i.uuid ?? ""),
    realname: String(i.realname ?? ""),
    order: typeof i.order === "number" ? i.order : 0,
    src: String(i.src ?? ""),
  }));

  let format_version: string =
    inner.format_version ?? episode.version_code ?? episode.version ?? "V1";
  if (Array.isArray(inner.spoints) && inner.spoints.length > 0) {
    const hasPositionRatio = inner.spoints.some(
      (s: any) => typeof s?.positionRatio === "number",
    );
    format_version = hasPositionRatio ? "V0" : "V1";
  }
  const replace_images = Array.isArray(inner.replace_images) ? inner.replace_images : [];

  const spoints: VogopangContentSpoint[] = (inner.spoints ?? []).map((s: any) => ({
    uuid: String(s.uuid ?? ""),
    top: typeof s.top === "number" ? s.top : 0,
    time_ms: typeof s.time_ms === "number" ? s.time_ms : Number(s.startMs ?? 0),
    transition_effect:
      s.transition_effect && typeof s.transition_effect === "object"
        ? {
            before_ms: Number(s.transition_effect.before_ms ?? 0),
            after_ms: Number(s.transition_effect.after_ms ?? 0),
          }
        : { before_ms: 0, after_ms: 0 },
    ...(typeof s.positionRatio === "number" && { positionRatio: s.positionRatio }),
  }));

  const tracks: VogopangContentTrack[] = (inner.tracks ?? []).map((t: any) => ({
    character_uuid: String(t.character_uuid ?? ""),
    character_name: String(t.character_name ?? ""),
    holes: (t.holes ?? []).map((h: any) => ({
      uuid: String(h.uuid ?? ""),
      script_uuid: String(h.script_uuid ?? h.uuid ?? ""),
      start_ms: Number(h.start_ms ?? 0),
      duration_ms: Number(h.duration_ms ?? 0),
      script: String(h.script ?? ""),
      index: typeof h.index === "number" ? h.index : 0,
      records: (h.records ?? []).map((r: any) => ({
        src: String(r.src ?? r.recordingFilePath ?? ""),
        artist_no: typeof r.artist_no === "number" ? r.artist_no : 0,
        ...(r.effects != null && { effects: r.effects }),
        ...(r.margin != null && { margin: r.margin }),
      })),
    })),
  }));

  const audio_tracks = Array.isArray(inner.audio_tracks) ? inner.audio_tracks : undefined;
  const inline_media = normalizeInlineMediaItems(inner.inline_media);

  return applyInlineMediaTimeline({
    images,
    replace_images,
    format_version: String(format_version),
    spoints,
    tracks,
    ...(audio_tracks && audio_tracks.length > 0 ? { audio_tracks } : {}),
    ...(inline_media ? { inline_media } : {}),
  });
}

/** 백엔드 `POST /player/info` JSON → 플레이어 `VogopangContent` */
export function normalizeBackendPayload(payload: PlayerContentPayload): NormalizedContentMatch {
  if (isPlaybackV2Envelope(payload)) {
    return {
      content: adaptPlaybackV2EnvelopeToRuntimeContent(payload),
      path: "playback-v2",
    };
  }

  const normalized = findNormalizedContent(payload);
  if (normalized) {
    if (typeof console !== "undefined" && console.info) {
      console.info("[playerContent] backend payload normalized", {
        routeVersion: ROUTE_VERSION,
        normalizedFrom: normalized.path,
      });
    }
    return normalized;
  }

  if (payload && typeof payload === "object") {
    console.error("[playerContent] backend payload shape", {
      topLevelKeys: Object.keys(payload as Record<string, unknown>).slice(0, 20),
      hasImages: Array.isArray((payload as Record<string, unknown>).images),
      hasData: typeof (payload as Record<string, unknown>).data === "object",
      hasResult: typeof (payload as Record<string, unknown>).result === "object",
      hasEpisode: typeof (payload as Record<string, unknown>).episode === "object",
      hasContent: typeof (payload as Record<string, unknown>).content !== "undefined",
    });
  } else {
    console.error("[playerContent] backend payload is not an object", {
      type: typeof payload,
      preview: String(payload).slice(0, 200),
    });
  }

  return {
    content: mapLibEpisodeToVogopangContent(payload),
    path: "legacy.data.episode.content",
  };
}
