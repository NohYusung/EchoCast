import type {
  VogopangContent,
  VogopangContentHole,
  VogopangContentTrack,
} from "@/data/vogopangContentTypes";
import { getFetchUrl, getMediaUrl } from "@/lib/environment";

export interface EpisodeRecordingApiItem {
  id?: number;
  holeId?: number;
  holeUuid?: string;
  uuid: string;
  script: string;
  characterName?: string;
  startMs?: number;
  trialStartMs?: number;
  durationMs?: number;
  trialDurationMs?: number;
  trialGuideSrc?: string;
  imageUuids?: string[];
  imageSrcs?: string[];
  records?: { src?: string };
}

export function uuidAliasKeys(raw: unknown): string[] {
  const value = String(raw ?? "").trim();
  if (!value) return [];
  const lower = value.toLowerCase();
  const compact = lower.replace(/-/g, "");
  return Array.from(new Set([value, lower, compact]));
}

export function collectHolesFromContent(content: VogopangContent | null | undefined) {
  const tracks = Array.isArray(content?.tracks) ? content.tracks : [];
  return tracks.flatMap((track: VogopangContentTrack) =>
    (track.holes ?? []).map((hole: VogopangContentHole) => ({
      ...hole,
      characterName: track.character_name,
    })),
  );
}

export async function fetchEpisodeRecordings(
  ..._args: unknown[]
): Promise<{
  data: { items: EpisodeRecordingApiItem[] };
}> {
  return { data: { items: [] } };
}

export function buildServerRecordingMapsByHoleUuid(
  _holes?: unknown,
  _items?: unknown,
) {
  return {
    recordingsByHoleUuid: {} as Record<string, { src: string }>,
    serverHoleIdByHoleUuid: {} as Record<string, number>,
  };
}

export function isUsableRecordingSrc(src: unknown): src is string {
  return typeof src === "string" && src.trim().length > 0;
}

export function inferEpisodeRecordingMimeType(src: unknown): string {
  const s = typeof src === "string" ? src.toLowerCase() : "";
  if (s.includes("mp4") || s.includes("m4a")) return "audio/mp4";
  if (s.includes("mpeg") || s.includes("mp3")) return "audio/mpeg";
  return "audio/webm";
}

export function canBrowserPlayRecordingMimeType(mimeType: string): boolean {
  if (typeof document === "undefined") return true;
  return document.createElement("audio").canPlayType(mimeType).length > 0;
}

export function resolveEpisodeRecordingAudioUrl(src: string): string {
  if (/^blob:|^https?:\/\//i.test(src)) return src;
  return getFetchUrl(getMediaUrl(src, "records"));
}

export async function postHoleRecording(_payload?: unknown): Promise<void> {
  throw new Error("test-player keeps recordings in local browser storage only.");
}

export function getEpisodeRecordingUploadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "녹음을 저장할 수 없습니다.";
}
