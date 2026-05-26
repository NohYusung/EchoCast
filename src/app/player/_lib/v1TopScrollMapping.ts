/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * V1 스크롤↔시간: **붕괴 판별·폴백**만 이 파일. 본계산은 `PositionCalculator.getPositionAtTimeV1` / `getTimeLineMsV1`.
 *
 * **용어:** `markers` 한 줄 = spoint 한 개 (`time_ms`, `top`, …).
 *
 * ---
 * ### 시나리오 A — V1 본로직을 탄다 (`getPositionAtTimeV1` 비붕괴)
 *
 * **왜 마커가 2개 이상이어야 하나**  
 * 알고리즘이 `time_ms` 기준으로 **인접한 두 마커 `[current, next]`** 로 시간 구간을 만든 뒤, 그 안에서만 `top`을 보간한다.  
 * 마커가 1개면 `next`가 없어 **구간 자체가 없음** → 본로직을 탈 수 없어 코드상 무조건 붕괴로 보낸다.
 *
 * **왜 `max(px)-min(px) >= DEGENERATE_PIXEL_SPREAD_MAX`(0.5px)까지 요구하나**  
 * 마커는 2개 이상이어도, 변환된 스크롤 픽셀 `px`가 전부 거의 같으면 **서로 다른 시각인데 스크롤 목표는 동일** → `top`으로 컷을 가를 수 없다고 보고 붕괴다. (전부 `top===0`이면 전형적)
 *
 * **한 줄 흐름:** `virtualTimeMs`가 들어간 `[current,next]` 찾기 → `before_ms`/`after_ms`로 구간을 자름 →  
 * 애니 구간에서는 `topBlend = lerp(current.top, next.top, animProgress)` →  
 * `scrollTop = -viewOffsetTop + (topBlend * calculatedWidth/baseWidth) * imageScale`.
 *
 * ---
 * ### 시나리오 B — 본로직을 안 탄다 (붕괴 → 폴백)
 *
 * **붕괴 조건 (`isV1TopMappingDegenerate`)**  
 * - 0개 / 1개 마커 → 위 이유로 즉시 붕괴.  
 * - 2개 이상 + `max(px)-min(px) < 0.5px` → 스크롤 목표가 구분 불가 → 붕괴.
 *
 * **붕괴 후 분기 (`classifyV1TopDegenerateMapping`) — 우선순위 순**
 *
 * 1. **`no-content-height`** — `scrollHeight` 등을 못 넘김 → V0/선형의 분모가 없음 → **첫 마커 `top`만** 픽셀화해 한 점 반환 (`v1FirstMarkerScrollTop`).
 * 2. **`v0-position-ratios`** — `max(ratio)-min(ratio) > 0.5%p` → **`getPositionAtTimeV0` / `getTimeLineMsV0`**: 시간↔`(positionRatio/100)*scrollHeight`.
 * 3. **`linear`** — ratio도 평탄 → **`positionAtTimeV1LinearFallback` / `timeLineMsV1LinearFallback`**:  
 *    `progress = time / tLast`, `scrollTop = progress * H` (역은 `scrollTop/denom * tLast`). `H = max(1, scrollRange||scrollHeight)`.
 */

/**
 * 각 마커의 `top`을 **현재 뷰 기준 세로 스크롤 픽셀**로 변환한 값의 배열.
 * `PositionCalculator.calculateViewTopV1` / 재생 루프의 `calculateViewTop`과 동일한 식이다.
 *
 * @param markers - spoint 목록. 각 원소의 `top`은 보통 460px 설계 기준 세로 오프셋.
 * @param viewOffsetTop - 뷰포트·이미지 배치에 따른 세로 보정(픽셀). `DisplayHelper.calculateViewOffsetTop` 계열에서 온 값.
 * @param imageScale - 이미지 세로 스케일. `workspaceOptions.image_scale` 등.
 * @param calculatedWidth - 실제로 그리는 컨텐츠 영역 너비(픽셀).
 * @param baseWidth - 설계 기준 너비. 보통 460 (`CARTOON_IMAGE_WIDTH_BASE`).
 *
 * @returns 각 마커에 대응하는 스크롤 `scrollTop` 후보(픽셀). 인덱스는 `markers`와 동일.
 *
 * 계산식 (마커 하나당):
 * - `screenRatio = calculatedWidth / baseWidth` — 설계 460폭 대비 실제 폭 비율.
 * - `adjustedTop = (m.top ?? 0) * screenRatio` — 설계 `top`을 가로 스케일에 맞춤.
 * - 픽셀 스크롤 = `-viewOffsetTop + adjustedTop * imageScale` — 세로 오프셋 반영 후 세로 스케일 적용.
 */
export function markerV1PixelScrollTops(
  markers: any[],
  viewOffsetTop: number,
  imageScale: number,
  calculatedWidth: number,
  baseWidth: number,
): number[] {
  const screenRatio = calculatedWidth / baseWidth;
  return markers.map((m) => {
    const adjustedTop = (m.top ?? 0) * screenRatio;
    return -viewOffsetTop + adjustedTop * imageScale;
  });
}

/**
 * V1 `top` 매핑이 **붕괴(degenerate)** 인지 판별한다.
 *
 * 붕괴이면 `getPositionAtTimeV1`은 `top` 구간 보간 대신 V0/선형 폴백으로 넘어간다.
 *
 * ## 판별 규칙
 * - 마커가 없거나 1개뿐이면 항상 true (구간 보간 자체가 성립하기 어렵다).
 * - 2개 이상이면 `markerV1PixelScrollTops`로 각 마커의 스크롤 픽셀을 구한 뒤,
 *   `max(pixels) - min(pixels) < DEGENERATE_PIXEL_SPREAD_MAX` 이면 true.
 *   (`DEGENERATE_PIXEL_SPREAD_MAX` 는 아래 상수 — 현재 0.5)
 * - 모든 `top`이 0이면 `adjustedTop`이 전부 0이라 픽셀이 동일해지기 쉽고, 대개 붕괴로 판정된다.
 *
 * ## 왜 픽셀 차이 0.5를 썼는가 (레포에 별도 스펙 문서는 없음)
 * - 단위는 **CSS 픽셀**에 가깝다. 브라우저는 `scrollTop` 등을 **기기/줌에 따라 반올림**하므로,
 *   “이론상 조금 다른 `top`”이라도 **화면에선 같은 스크롤로 수렴**할 수 있다.
 * - **0.5px**는 흔히 쓰는 **반 픽셀 단위 엡실론**으로,
 *   “컷마다 스크롤 목표가 구분 가능한가?”를 **부동소수·서브픽셀 노이즈까지 감안한 실무 기준**으로 잡은 값이다.
 * - 즉 **수학 유도 상수가 아니라 튜닝용 매직 넘버**에 가깝고, 기기/OS별 오동작이 보이면 팀에서 재조정해도 된다.
 */
export const DEGENERATE_PIXEL_SPREAD_MAX = 0.5;
export function isV1TopMappingDegenerate(
  markers: any[],
  viewOffsetTop: number,
  imageScale: number,
  calculatedWidth: number,
  baseWidth: number,
): boolean {
  if (!markers || markers.length === 0) return true;
  if (markers.length === 1) return true;
  const pixels = markerV1PixelScrollTops(markers, viewOffsetTop, imageScale, calculatedWidth, baseWidth);
  const minPx = Math.min(...pixels);
  const maxPx = Math.max(...pixels);
  return maxPx - minPx < DEGENERATE_PIXEL_SPREAD_MAX;
}

/**
 * 마커들의 `positionRatio`(스크롤 진행률 %, V0 개념)가 서로 충분히 벌어져 있는지.
 *
 * - `ratios`: 각 마커의 `positionRatio ?? 0` 목록.
 * - `max(ratios) - min(ratios) > MEANINGFUL_POSITION_RATIO_SPREAD_MIN` 이면 true.
 *
 * ## 왜 0.5(퍼센트 포인트)를 썼는가
 * - `positionRatio`는 보통 0~100 스케일의 **퍼센트**다. 마커마다 차이가 **0.5% 미만**이면
 *   스크롤 진행도가 사실상 평탄해 V0 구간 보간이 **시간↔스크롤을 제대로 나누지 못한다**고 본다.
 * - 이 역시 **레포 외부 스펙으로 증명된 값은 아니고**, “너무 좁으면 V0 폴백을 쓰지 말자”는 **경험적 하한**에 가깝다.
 * - 붕괴 시 V0 경로를 탈지 말지 가르는 용도이므로, 콘텐츠 품질에 맞춰 조정 가능하다.
 */
export const MEANINGFUL_POSITION_RATIO_SPREAD_MIN = 0.5;

export function hasMeaningfulPositionRatioSpread(markers: any[]): boolean {
  const ratios = markers.map((m) => m.positionRatio ?? 0);
  return Math.max(...ratios) - Math.min(...ratios) > MEANINGFUL_POSITION_RATIO_SPREAD_MIN;
}

/** `time_ms` 오름차순 정렬 복사본 (원본 배열은 변경하지 않음). */
function sortMarkersByTimeMs(markers: any[]): any[] {
  return [...markers].sort((a, b) => (a.time_ms ?? 0) - (b.time_ms ?? 0));
}

/**
 * 붕괴 + `positionRatio`도 못 쓸 때: **현재 스크롤 위치 → 대략적인 타임라인 시각(ms)**.
 *
 * 가정: 스크롤 깊이와 “에피소드 끝 시각”이 비례한다는 **단순 선형 모델** (컷 단위 정밀도는 낮음).
 *
 * @param scrollTop - 스크롤 컨테이너의 `scrollTop` (픽셀).
 * @param markers - `time_ms`가 채워진 spoint 목록.
 * @param scrollHeight - 분모로 쓸 스크롤 길이. 보통 `scrollRange`(scrollHeight - clientHeight) 또는 전체 `scrollHeight`에 가까운 값.
 *   - `denom = max(1, scrollHeight)` 로 0 나눗셈 방지.
 *
 * 내부 변수:
 * - `sorted`: 시간순 마커.
 * - `tLast`: 마지막 마커의 `time_ms` — 선형 매핑의 “끝 시각”으로 사용.
 * - `ratio = clamp(scrollTop / denom, 0, 1)` — 스크롤 진행도 0~1.
 * - 반환값: 마커가 1개면 `ratio * t`, 여러 개면 `ratio * tLast` (단일 마커는 끝 시각이 곧 그 컷).
 */
export function timeLineMsV1LinearFallback(
  scrollTop: number,
  markers: any[],
  scrollHeight: number,
): number {
  const sorted = sortMarkersByTimeMs(markers);
  const tLast = sorted[sorted.length - 1]?.time_ms ?? 0;
  const denom = Math.max(1, scrollHeight);
  const ratio = Math.min(1, Math.max(0, scrollTop / denom));

  if (sorted.length === 1) {
    const t = tLast;
    return ratio * Math.max(0, t);
  }
  return ratio * Math.max(0, tLast);
}

/**
 * 붕괴 + `positionRatio`도 못 쓸 때: **가상 재생 시각(ms) → 스크롤 픽셀**.
 *
 * `timeLineMsV1LinearFallback`의 역방향에 해당하는 단순 모델이다.
 *
 * @param virtualTimeMs - 재생 타임라인 상의 시각 (ms).
 * @param markers - `time_ms`가 채워진 spoint 목록.
 * @param scrollHeight - 스크롤 가능한 길이(픽셀). `max(0, scrollHeight)`만 적용해 음수 방지.
 *
 * 내부 변수:
 * - `tLast`: 시간순 마지막 마커의 `time_ms` — 전체 길이의 시간 끝.
 * - `progress = clamp(virtualTimeMs / tLast, 0, 1)` (단, `tLast <= 0`이면 0).
 * - 마커 1개일 때는 분모를 `t`(그 마커의 `time_ms`)로 써서 `virtualTimeMs / t` 로 진행률을 잡는다.
 * - 반환: `progress * height` — 스크롤바 위치 픽셀.
 */
export function positionAtTimeV1LinearFallback(
  virtualTimeMs: number,
  markers: any[],
  scrollHeight: number,
): number {
  const sorted = sortMarkersByTimeMs(markers);
  const tLast = sorted[sorted.length - 1]?.time_ms ?? 0;
  const height = Math.max(0, scrollHeight);

  if (sorted.length === 1) {
    const t = tLast;
    if (t <= 0) return 0;
    const progress = Math.min(1, Math.max(0, virtualTimeMs / t));
    return progress * height;
  }
  if (tLast <= 0) return 0;
  const progress = Math.min(1, Math.max(0, virtualTimeMs / tLast));
  return progress * height;
}

/**
 * `isV1TopMappingDegenerate === true` 일 때, 그 다음에 어떤 **폴백 경로**를 탈지 구분한다.
 *
 * - `no-content-height`: `contentScrollHeight <= 0` — 스크롤 영역 높이를 알 수 없어 V0/선형 분모를 둘 수 없음.
 * - `v0-position-ratios`: `hasMeaningfulPositionRatioSpread` — `positionRatio`로 스크롤%↔시간 매핑 가능.
 * - `linear`: 그 외 — 시간과 스크롤을 끝 시각·스크롤 길이로만 나누는 선형 폴백.
 */
export type V1TopDegenerateKind = "no-content-height" | "v0-position-ratios" | "linear";

/**
 * @param markers - 붕괴 상태에서도 `positionRatio`/`time_ms` 검사에 사용.
 * @param contentScrollHeight - 콘텐츠 `scrollHeight` 등, 0 이하면 높이 미확보로 본다.
 */
export function classifyV1TopDegenerateMapping(
  markers: any[],
  contentScrollHeight: number,
): V1TopDegenerateKind {
  if (contentScrollHeight <= 0) return "no-content-height";
  if (hasMeaningfulPositionRatioSpread(markers)) return "v0-position-ratios";
  return "linear";
}

/**
 * 스크롤 높이를 알 수 없을 때의 최후 픽셀: **첫 번째 마커의 `top`만** `calculateViewTopV1`과 같은 식으로 변환한다.
 *
 * - `markers[0].top`이 없거나 0이면, 결과는 대개 `-viewOffsetTop` 근처(상단 오프셋만 반영)가 된다.
 * - 여러 컷을 구분하지 못하는 한계는 그대로이며, “스크롤 위치 하나라도 잡자”는 용도다.
 *
 * 계산: `screenRatio = calculatedWidth / baseWidth`, `adjustedTop = firstTop * screenRatio`,
 * 반환 `-viewOffsetTop + adjustedTop * imageScale` (`markerV1PixelScrollTops`의 첫 원소와 동일 공식).
 */
export function v1FirstMarkerScrollTop(
  markers: any[],
  calculatedWidth: number,
  baseWidth: number,
  viewOffsetTop: number,
  imageScale: number,
): number {
  const screenRatio = calculatedWidth / baseWidth;
  const adjustedTop = (markers[0]?.top ?? 0) * screenRatio;
  return -viewOffsetTop + adjustedTop * imageScale;
}
