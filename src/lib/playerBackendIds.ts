export type BackendKeyMap = Record<string, { seriesId: number; episodeId: number }>;

/**
 * `playerKey` → 백엔드 `POST /player/info` body.
 * 추가 키는 URL 쿼리 `seriesId`·`episodeId` 또는 여기 상수에만 넣는다.
 */
export const DEFAULT_PLAYER_API_KEY_MAP: BackendKeyMap = {
  "three-kingdoms-ep1": { seriesId: 46, episodeId: 344 },
};

export function resolvePlayerBackendIds(
  keyMap: BackendKeyMap,
  playerKey: string,
  seriesId: number | null,
  episodeId: number | null,
) {
  if (seriesId != null && episodeId != null) {
    return { seriesId, episodeId };
  }

  return keyMap[playerKey] ?? null;
}
