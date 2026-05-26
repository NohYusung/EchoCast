import type { PlayerEpisodeListItem } from "@/app/player/playerEpisodeListData";

function getResultData(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const result = p.result;
  if (result && typeof result === "object") {
    const data = (result as Record<string, unknown>).data;
    if (data && typeof data === "object") return data as Record<string, unknown>;
  }
  const data = p.data;
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return null;
}

function parseChapterOrder(chapter: string): number {
  const n = Number(String(chapter).trim());
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function isRecordingFlag(value: unknown): boolean {
  if (value === true) return true;
  if (value === "true" || value === "1" || value === 1) return true;
  return false;
}

/**
 * `POST /player/info` 원본 응답에서 시리즈 ID·에피소드 목록 추출 (회차 정렬: chapter 숫자 오름차순).
 */
export function extractSeriesEpisodeNavFromPlayerInfoPayload(
  payload: unknown,
): { seriesId: number; items: PlayerEpisodeListItem[] } | null {
  const data = getResultData(payload);
  if (!data || !Array.isArray(data.episodes)) return null;

  const episodeRoot = data.episode;
  const seriesRaw =
    episodeRoot && typeof episodeRoot === "object"
      ? (episodeRoot as Record<string, unknown>).seriesId
      : undefined;
  const seriesId = typeof seriesRaw === "number" ? seriesRaw : Number(seriesRaw);
  if (!Number.isFinite(seriesId)) return null;

  const raw = data.episodes as unknown[];
  const items: PlayerEpisodeListItem[] = [];

  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "number" ? o.id : Number(o.id);
    const title = typeof o.title === "string" ? o.title : "";
    const chapter = typeof o.chapter === "string" ? o.chapter : String(o.chapter ?? "");
    const thumbnail =
      typeof o.thumbnail === "string"
        ? o.thumbnail
        : typeof o.thumbnailImageUrl === "string"
          ? o.thumbnailImageUrl
          : "";
    if (!Number.isFinite(id)) continue;
    items.push({
      id,
      title: title || `회차 ${id}`,
      chapter,
      thumbnail,
      isRecordingEpisode:
        isRecordingFlag(o.isRecordingEpisode) || isRecordingFlag(o.isRecording),
    });
  }

  if (items.length === 0) return null;

  items.sort(
    (a, b) => parseChapterOrder(a.chapter) - parseChapterOrder(b.chapter),
  );

  return { seriesId, items };
}

/**
 * 좌측 하단「마이 보이스」녹음 진입 버튼 — 작품 상세 퍼플 라벨(`isRecordingEpisode`)과 동일 기준.
 * `playerSeriesEpisodeNav`가 있으면 해당 회차 행만 사용하고, 없으면 `GET /holes`로 서버 홀 존재 여부를 본다.
 */
export function shouldShowPlayerMyVoiceRecordingEntry(args: {
  showExperienceEntry: boolean;
  episodeNumericId: number;
  navItems: PlayerEpisodeListItem[] | undefined;
  /** `GET /holes` — nav가 없을 때만 해석 (true: 홀 있음, false: 없음·실패, null: 아직 로딩) */
  episodeHasServerHoles: boolean | null;
  /** `episodeId` 없이 로컬 체험만 열린 경우 JSON 트랙 홀 개수 */
  localContentHoleCount: number;
}): boolean {
  if (!args.showExperienceEntry) return false;
  const eid = args.episodeNumericId;
  const items = args.navItems;
  if (items && items.length > 0) {
    if (!Number.isFinite(eid) || eid <= 0) return false;
    const row = items.find((i) => i.id === eid);
    return row?.isRecordingEpisode === true;
  }
  if (args.episodeHasServerHoles === true) return true;
  if ((!Number.isFinite(eid) || eid <= 0) && args.localContentHoleCount > 0) return true;
  return false;
}

/** 헤더·스트립 — `chapter`가 이미 `N화` 형태면 그대로, 아니면 `화` 접미 */
export function chapterLabelForEpisodeListItem(item: PlayerEpisodeListItem): string {
  const ch = item.chapter.trim();
  if (ch.endsWith("화")) return ch;
  if (ch) return `${ch}화`;
  return `${item.id}화`;
}

/**
 * API `title`에 `4화 …`처럼 회차 접두가 포함된 경우, 헤더 첫 줄(`chapterLabel`)과 겹치지 않게 제거.
 * `4화 / 4화 제목` 형태도 앞쪽 중복만 정리한다.
 */
export function stripDuplicateChapterLabelFromTitle(
  episodeTitle: string,
  chapterLabel: string,
): string {
  const t = episodeTitle.trim();
  const ch = chapterLabel.trim();
  if (!t) return t;
  if (!ch) return t;
  if (t === ch) return "";

  const splitDup = new RegExp(
    `^${escapeRegExp(ch)}\\s*(?:[/／]\\s*)${escapeRegExp(ch)}\\s+`,
  );
  if (splitDup.test(t)) {
    return t.replace(splitDup, "").trim();
  }

  const anchored = new RegExp(`^${escapeRegExp(ch)}(?=\\s|[/／·:：]|$)`);
  if (anchored.test(t)) {
    return t
      .slice(ch.length)
      .trim()
      .replace(/^[/／·:：\s]+/, "")
      .trim();
  }

  return t;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
