/**
 * 플레이어에서 사용하는 아이콘 경로 (public/images/player, public/icons/player, public/icons__ 기준)
 */
const PLAYER_IMAGE = "/images/player";
const ICONS = "/icons/player";
const ICONS_TOON = "/icons__";

export const playerIcons = {
  // 재생/일시정지
  play: `${ICONS}/playtWhite.svg`,
  pause: `${ICONS}/pause.svg`,
  // 말풍선
  removeBubble: `${PLAYER_IMAGE}/removeBubble.svg`,
  removeOffBubble: `${PLAYER_IMAGE}/removeOffBubble.svg`,
  // 음소거/스피커
  mute: `${ICONS}/volume.svg`,
  speakActive: `${ICONS}/volume.svg`,
  // 하단 메뉴
  listActive: `${ICONS}/list.svg`,
  thumbnail: `${PLAYER_IMAGE}/thumbnail.png`,
  muticasting: `${ICONS}/record.svg`,
  startOn: `${PLAYER_IMAGE}/startOn.svg`,
  startOnActive: `${PLAYER_IMAGE}/startOnActive.svg`,
  prev: "/icons/common/leftArrow.svg",
  next: "/icons/common/leftArrow.svg",
  // 다이얼로그
  expandedClose: `${PLAYER_IMAGE}/expandedClose.svg`,
  episodeLock: `${PLAYER_IMAGE}/episodeLock.svg`,
  episodeListScroll: `${PLAYER_IMAGE}/episodeListScroll.svg`,
} as const;

/** ToonButtons용 아이콘 (icon_name → 경로) */
export const toonButtonIcons = {
  icon_play: `${ICONS_TOON}/icon_play.svg`,
  icon_play_pause: `${ICONS_TOON}/icon_play_pause.svg`,
  icon_voice_artist: `${ICONS_TOON}/icon_voice_artist.svg`,
  icon_review: `${ICONS_TOON}/icon_review.svg`,
} as const;

export type PlayerIconKey = keyof typeof playerIcons;
export type ToonButtonIconName = keyof typeof toonButtonIcons;
