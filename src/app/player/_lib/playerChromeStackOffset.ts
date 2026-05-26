/**
 * `PlayerControls` 하단 스택(에피소드 스트립 → 녹음 마커 → 하단 네비) 높이에 맞춰
 * 몰입 모드 피크 바의 `bottom` 오프셋을 계산한다. (전체 UI일 때 재생 행과 동일한 세로 위치)
 */

export interface PlayerChromeStackOffsetOptions {
  /** `PlayerControls`와 동일: calculatedWidthCustom > 768 */
  isDesktop: boolean;
  hasRecordingStrip: boolean;
  isEpisodeListOpen: boolean;
}

/**
 * CSS `calc(...)` 문자열 — `position: fixed` 요소의 `bottom`에 그대로 사용.
 */
export function getPlayerImmersivePeekBottomOffset(
  options: PlayerChromeStackOffsetOptions,
): string {
  const { isDesktop, hasRecordingStrip, isEpisodeListOpen } = options;

  const nav = isDesktop
    ? "84px + env(safe-area-inset-bottom)"
    : "49px + env(safe-area-inset-bottom)";

  const recording = isDesktop ? 116 : 90;
  const episode = isDesktop ? 156 : 124;

  const extraPx = [
    hasRecordingStrip ? recording : 0,
    isEpisodeListOpen ? episode : 0,
  ].reduce((a, b) => a + b, 0);

  if (extraPx === 0) {
    return `calc(${nav})`;
  }

  return `calc(${nav} + ${extraPx}px)`;
}
