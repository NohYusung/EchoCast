/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  VogopangContent,
  VogopangContentImage,
  VogopangContentSpoint,
  VogopangContentTrack,
} from "@/data/vogopangContentTypes";

export const ROUTE_VERSION = "normalize-v4-recursive-2026-03-26";

export type PlayerContentPayload = VogopangContent | Record<string, unknown>;

export type NormalizedContentMatch = { content: VogopangContent; path: string };

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

function coerceNormalizedContent(value: Record<string, unknown>): VogopangContent {
  return {
    images: Array.isArray(value.images) ? (value.images as VogopangContent["images"]) : [],
    replace_images: Array.isArray(value.replace_images) ? value.replace_images : [],
    format_version:
      typeof value.format_version === "string" ? value.format_version : "V1",
    spoints: Array.isArray(value.spoints) ? (value.spoints as VogopangContent["spoints"]) : [],
    tracks: Array.isArray(value.tracks) ? (value.tracks as VogopangContent["tracks"]) : [],
    ...(Array.isArray(value.audio_tracks) ? { audio_tracks: value.audio_tracks } : {}),
  };
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

  return {
    images,
    replace_images,
    format_version: String(format_version),
    spoints,
    tracks,
    ...(audio_tracks && audio_tracks.length > 0 ? { audio_tracks } : {}),
  };
}

/** 백엔드 `POST /player/info` JSON → 플레이어 `VogopangContent` */
export function normalizeBackendPayload(payload: PlayerContentPayload): NormalizedContentMatch {
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
