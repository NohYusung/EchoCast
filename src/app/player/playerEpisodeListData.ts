/**
 * `POST /player/info` 응답의 `data.episodes[]` 한 행 — 플레이어 에피소드 가로 목록·이전/다음 화에 그대로 사용.
 */

export interface PlayerEpisodeListItem {
  id: number;
  title: string;
  chapter: string;
  thumbnail: string;
  /** 작품 상세 `isRecordingEpisode`와 동일 — 해당 회차가 마이 보이스(녹음) 대상인지 */
  isRecordingEpisode: boolean;
}
