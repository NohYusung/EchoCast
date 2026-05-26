/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * toonWorkCommon.ts
 * Common utilities and functions shared between useToonWork and useV0ToonWork
 */

import { getLibMediaUrl, getMediaUrl, isLibMediaPath } from '@/lib/environment';
import { playerLogger } from './playerLogger';
import {
  classifyV1TopDegenerateMapping,
  isV1TopMappingDegenerate as isV1TopMappingDegenerateUtil,
  positionAtTimeV1LinearFallback,
  timeLineMsV1LinearFallback,
  v1FirstMarkerScrollTop,
} from './v1TopScrollMapping';

// --- Debug Utilities ---
export const DEBUG_VOICE_LOADING = true;

export function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    playerLogger.log('[ToonWork]', ...args);
  }
}

export function devError(...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    playerLogger.error('[ToonWork]', ...args);
  }
}

export function debugVoiceLog(...args: unknown[]) {
  if (DEBUG_VOICE_LOADING && process.env.NODE_ENV === 'development') {
    playerLogger.log('[🎤 VOICE DEBUG]', ...args);
  }
}

// --- Constants ---
export const CARTOON_IMAGE_WIDTH_BASE_SIZE = 690;
export const CARTOON_IMAGE_WIDTH_BASE = 460;
export const IMAGE_WIDTH_SCALE_BASE = 2 / 3;

// --- Display & Scaling Utilities ---
export class DisplayHelper {
  /**
   * 화면 너비를 계산하되, 9:16 비율을 유지하도록 제한
   * @param baseWidth - 기본 너비 (460px)
   * @returns 계산된 너비
   */
  static calculateWidth(baseWidth: number): number {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // 9:16 비율로 최대 허용 너비 계산
    const maxWidthByHeight = (windowHeight * 9) / 16;

    // 세 가지 값 중 최소값 선택
    // 1. 실제 화면 너비
    // 2. 높이에서 계산된 최대 너비 (9:16 비율 유지)
    // 3. 기본 너비 (baseWidth)
    return Math.min(windowWidth, maxWidthByHeight, baseWidth);
  }

  /**
   * V1용 화면 너비 계산 (460px 기준, 9:16 비율 유지)
   * @param baseWidth - 기본 너비 (460px)
   * @returns 계산된 너비
   */
  static calculateWidthV1(baseWidth: number = CARTOON_IMAGE_WIDTH_BASE): number {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // 9:16 비율로 최대 허용 너비 계산
    const maxWidthByHeight = (windowHeight * 9) / 16;

    // 화면 너비와 높이 기반 너비 중 작은 값 선택
    const constrainedWidth = Math.min(windowWidth, maxWidthByHeight);

    // baseWidth(460)를 초과하지 않도록 제한
    return Math.min(constrainedWidth, baseWidth);
  }

  /**
   * V0용 화면 너비 계산 (기존 로직 유지)
   * @param baseWidth - 기본 너비
   * @returns 계산된 너비
   */
  static calculateWidthV0(baseWidth: number): number {
    return Math.min(window.innerWidth, baseWidth);
  }

  static calculateScale(
    calculatedWidth: number,
    baseWidth: number,
    baseScale: number
  ): number {
    const ratio = calculatedWidth / baseWidth;
    return baseScale * ratio;
  }

  static calculateViewOffsetTop(
    imageWidthOriginal: number,
    imageWidthScale: number
  ): number {
    return imageWidthOriginal * imageWidthScale * (16 / 9) * 0.1;
  }
}

// --- Audio Control Utilities ---
export class AudioController {
  /**
   * Tone.js 전역 볼륨 제어
   * @param muted - true면 음소거, false면 해제
   */
  static async setGlobalMute(muted: boolean): Promise<void> {
    try {
      const Tone = await import('tone');

      // Tone.js AudioContext가 suspended 상태면 resume
      if (Tone.context.state === 'suspended') {
        await Tone.context.resume();
      }

      if (muted) {
        Tone.Destination.volume.value = -Infinity;
        playerLogger.log('[AudioController] 음소거 활성화: -Infinity');
      } else {
        Tone.Destination.volume.value = 0;
        playerLogger.log('[AudioController] 음소거 해제: 0');
      }
    } catch (error) {
      playerLogger.error('[AudioController] setGlobalMute 오류:', error);
    }
  }

  /**
   * 재생 시작 시 음소거 상태 적용
   * @param isMuted - 현재 음소거 상태
   */
  static async applyMuteState(isMuted: boolean): Promise<void> {
    playerLogger.log(`[AudioController] applyMuteState 호출: ${isMuted ? 'MUTED' : 'UNMUTED'}`);
    await AudioController.setGlobalMute(isMuted);
  }
}

// --- Effect Utilities ---
export class EffectProcessor {
  /**
   * Effect 데이터 가공 (playSpeed 적용)
   */
  static processEffects(effects: any[], playSpeed: number = 1.0): any[] {
    if (!effects) return [];

    return effects.map(effect => ({
      ...effect,
      time_ms: effect.time_ms / playSpeed,
      params: {
        ...effect.params,
        duration:
          effect.params?.duration && effect.params?.duration > playSpeed
            ? effect.params?.duration / playSpeed
            : 0,
      },
      timer: null,
    }));
  }

  /**
   * Effect 병합 (hole effect와 record effect)
   */
  static mergeEffects(
    holeEffect: any | null = null,
    recordEffect: any | null = null
  ): any | null {
    if (holeEffect == null || recordEffect == null) {
      return recordEffect ?? holeEffect;
    }
    if (Object.keys(holeEffect).length === 0) {
      return recordEffect;
    }
    if (Object.keys(recordEffect).length === 0) {
      return holeEffect;
    }
    return recordEffect;
  }
}

// --- DOM Utilities ---
export class DOMHelper {
  /**
   * 툰 컨텐츠 이미지 리스트 엘리먼트 찾기
   * 두 개의 레이어(일반/ClearText) 중 현재 visible한 레이어를 반환
   */
  static getToonContentImageList(): HTMLElement | null {
    // 모든 toon-scroll-layer를 찾아서 visible한 것 반환
    const scrollLayers = document.querySelectorAll('.toon-scroll-layer') as NodeListOf<HTMLElement>;
    for (const layer of scrollLayers) {
      // display가 none이 아닌 레이어 찾기 (부모의 display 체크)
      const parent = layer.parentElement?.parentElement; // ToonBox wrapper div
      if (parent && window.getComputedStyle(parent).display !== 'none') {
        return layer;
      }
    }

    // fallback: 첫 번째 레이어 반환
    if (scrollLayers.length > 0) {
      return scrollLayers[0];
    }

    const scrollArea = document.querySelector('.q-scroll-area__container') as HTMLElement;
    if (scrollArea) {
      return scrollArea;
    }

    devLog('스크롤 컨테이너를 찾을 수 없습니다.');
    return null;
  }

  /**
   * 스크롤 위치 설정
   */
  static setScrollTop(position: number): void {
    const contentList = DOMHelper.getToonContentImageList();
    if (!contentList) {
      devLog('스크롤 컨테이너를 찾을 수 없어 스크롤 위치를 설정할 수 없습니다.');
      return;
    }
    contentList.scrollTop = position;
  }

  /**
   * 현재 스크롤 위치 가져오기
   */
  static getScrollTop(): number {
    const contentList = DOMHelper.getToonContentImageList();
    return contentList?.scrollTop ?? 0;
  }

  /**
   * 스크롤 높이 가져오기
   */
  static getScrollHeight(): number {
    const contentList = DOMHelper.getToonContentImageList();
    return contentList?.scrollHeight ?? 0;
  }
}

// --- Animation Utilities ---
export class AnimationController {
  /**
   * 타이머 정리
   */
  static clearTimers(timers: Array<{ clear: () => void } | number>): void {
    timers.forEach((timer) => {
      if (typeof timer === 'object' && 'clear' in timer) {
        timer.clear();
      } else if (typeof timer === 'number') {
        clearTimeout(timer);
      }
    });
  }

  /**
   * 모든 애니메이션 중지
   */
  static stopAllAnimations(
    shouldStopRef: React.MutableRefObject<boolean>,
    animationId: number | null
  ): void {
    shouldStopRef.current = true;
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }
  }
}

// --- Voice Loading Utilities ---
export interface VoiceLoadingStats {
  mainCharacterLoaded: number;
  mainCharacterSkipped: number;
  supportingCharacterLoaded: number;
}

export class VoiceLoadingHelper {
  /**
   * 보이스 로딩 통계 로그 출력
   */
  static logLoadingStats(stats: VoiceLoadingStats, totalCount: number): void {
    debugVoiceLog('\n========== 보이스 로딩 완료 ==========');
    debugVoiceLog(`주조연 캐릭터 - 로드된 레코드: ${stats.mainCharacterLoaded}개`);
    debugVoiceLog(`주조연 캐릭터 - 스킵된 레코드: ${stats.mainCharacterSkipped}개`);
    debugVoiceLog(`단역 캐릭터 - 로드된 레코드: ${stats.supportingCharacterLoaded}개`);
    debugVoiceLog(`최종 총 개수: ${totalCount}개`);
    debugVoiceLog('========================================\n');
  }

  /**
   * Hole 레코드 경고 로그
   */
  static logMultipleRecordsWarning(
    recordCount: number,
    startMs: number,
    characterUuid: string,
    artistNos: number[]
  ): void {
    debugVoiceLog(
      `⚠️ 경고: Hole에 ${recordCount}개의 레코드가 있습니다! (최대 1개만 허용)`,
      `\n  - Hole 시작 시간: ${startMs}ms`,
      `\n  - 캐릭터 UUID: ${characterUuid}`,
      `\n  - 레코드 artist_no 목록:`, artistNos,
      `\n  ➡️ 첫 번째 레코드만 사용합니다.`
    );
  }
}

// --- Marker Utilities ---
export class MarkerHelper {
  /**
   * 마커 데이터 정규화
   */
  static normalizeMarker(marker: any): any {
    return {
      ...marker,
      positionRatio: marker.positionRatio ?? 0,
      top: marker.top ?? 0,
      time_ms: marker.time_ms ?? marker.startMs ?? 0,
      startMs: marker.startMs ?? marker.time_ms ?? 0,
      index: marker.index ?? 0,
      timer: null,
    };
  }

  /**
   * 마커 정렬 (index 기준)
   */
  static sortByIndex(markers: any[]): any[] {
    return [...markers].sort((a, b) => a.index - b.index);
  }

  /**
   * 마커 정렬 (time_ms 기준)
   */
  static sortByTime(markers: any[]): any[] {
    return [...markers].sort((a, b) => (a.time_ms ?? 0) - (b.time_ms ?? 0));
  }
}

// --- Image Utilities ---
export class ImageHelper {
  /**
   * 이미지 URL 추출. lib(webtoon/...) 경로는 전용 media base를 사용한다.
   */
  static getImageUrl(image: any): string {
    const path = image.url || image.rawSrc || image.src;
    if (typeof path !== 'string') {
      return '';
    }
    return isLibMediaPath(path) ? getLibMediaUrl(path) : getMediaUrl(path, 'image');
  }

  /**
   * 이미지 키 생성
   */
  static getImageKey(image: any, index: number, version: 'V0' | 'V1'): string {
    if (version === 'V0') {
      return `${image.uuid || image.id || index}`;
    }
    return `${image.url}-${index}`;
  }
}

// --- Timer & Cleanup Utilities ---
export class TimerHelper {
  /**
   * 타이머 배열 정리
   */
  static clearTimers(timers: Array<{ clear: () => void } | number>): void {
    timers.forEach((timer) => {
      if (typeof timer === 'object' && 'clear' in timer) {
        timer.clear();
      } else if (typeof timer === 'number') {
        clearTimeout(timer);
      }
    });
  }

  /**
   * ShockWave 배열 정리 (재생만 중지, Player는 유지)
   */
  static clearShockWaves(shockWaves: any[]): void {
    for (const shockWave of shockWaves) {
      if (shockWave.shockWave) {
        shockWave.shockWave.stopSound();
        // destroy()를 호출하지 않음 - Player를 유지하여 재생 가능하도록 함
        if (shockWave.timer) {
          clearTimeout(shockWave.timer);
          shockWave.timer = null;
        }
      }
    }
  }

  /**
   * ShockWave 배열 완전 정리 (Player까지 제거)
   */
  static destroyShockWaves(shockWaves: any[]): void {
    for (const shockWave of shockWaves) {
      if (shockWave.shockWave) {
        shockWave.shockWave.stopSound();
        if (typeof shockWave.shockWave.destroy === 'function') {
          shockWave.shockWave.destroy();
        }
        if (shockWave.timer) {
          clearTimeout(shockWave.timer);
          shockWave.timer = null;
        }
      }
    }
  }

  /**
   * 마커/이펙트 타이머 정리
   */
  static clearMarkerEffectTimers(items: any[]): void {
    for (const item of items) {
      if (item.timer) {
        clearTimeout(item.timer);
      }
    }
  }
}

// --- Player Control Utilities ---
export class PlayerControlHelper {
  /**
   * 스크롤 기반 ToonWork 정지
   */
  static stopScrollBaseToonWork(): void {
    const contentList = document.querySelector('#toon-content-image-list') as HTMLElement;
    if (contentList) {
      contentList.style.scrollBehavior = 'auto';
    }

    const overlay = document.querySelector('#toon-overlay-fade-effect') as HTMLElement;
    if (overlay) {
      overlay.style.backgroundColor = 'transparent';
      overlay.style.transition = 'opacity 0ms linear';
      overlay.style.opacity = '0';
    }
  }

  /**
   * 모든 애니메이션 정지 플래그 설정
   */
  static setShouldStopAnimations(shouldStopRef: React.MutableRefObject<boolean>, value: boolean): void {
    shouldStopRef.current = value;
  }

  /**
   * ToonWorkRef의 이펙트 정지
   */
  static stopToonWorkEffects(toonWorkRef: React.MutableRefObject<any>): void {
    if (toonWorkRef.current && typeof toonWorkRef.current.stopAllEffects === 'function') {
      toonWorkRef.current.stopAllEffects();
    }
  }
}

// --- Spoint Mapping Utilities ---
export class SpointMappingHelper {
  /**
   * Voicetoon spoint 매핑
   */
  static getSpointMappingVoicetoon(spointMappingData: any[], spoint: number): number {
    if (!spointMappingData || spointMappingData.length === 0) return 0;

    let point = 0;
    for (const a of spointMappingData) {
      const wtSpoint = parseInt(a.wt_spoint ?? '0');
      if (wtSpoint >= spoint) {
        point = parseInt(a.vt_spoint ?? '0');
        break;
      }
    }
    return point;
  }

  /**
   * Webtoon spoint 매핑
   */
  static getSpointMappingWebtoon(spointMappingData: any[], spoint: number): number {
    if (!spointMappingData || spointMappingData.length === 0) return 0;

    let point = 0;
    for (const a of spointMappingData) {
      const vtSpoint = parseInt(a.vt_spoint ?? '0');
      if (vtSpoint >= spoint) {
        point = parseInt(a.wt_spoint ?? '0');
        break;
      }
    }
    return point;
  }
}

// --- Setup Utilities ---
export class SetupHelper {
  /**
   * 마커 셋업 (공통 로직)
   */
  static async setupMarkers(content: any): Promise<any[]> {
    const newMarkers: any[] = [];
    if (content.spoints) {
      for (const marker of content.spoints) {
        newMarkers.push(MarkerHelper.normalizeMarker(marker));
      }
    }
    const sorted = MarkerHelper.sortByIndex(newMarkers);

    // V0(lib) 디버깅용: positionRatio/시간 로그 (최대 5개만)
    if ((content.format_version ?? '').toUpperCase().includes('V0') && sorted.length > 0) {
      playerLogger.log(
        '[SetupHelper.setupMarkers] V0 markers',
        sorted.slice(0, 5).map((m: any) => ({
          time_ms: m.time_ms,
          positionRatio: m.positionRatio,
        }))
      );
    }

    return sorted;
  }

  /**
   * 이펙트 셋업 (공통 로직)
   */
  static async setupEffects(content: any, playSpeed: number = 1.0): Promise<any[]> {
    if (!content.effects) return [];
    return EffectProcessor.processEffects(content.effects, playSpeed);
  }
}

// --- Position Calculation Utilities ---
export class PositionCalculator {
  /**
   * spoint top이 모두 같거나 0 등으로 스크롤↔시간 매핑이 불가능한 경우.
   * (멈춤 후 재생 시 getTimeLineMsV1이 항상 0을 내는 원인)
   */
  static isV1TopMappingDegenerate(
    markers: any[],
    viewOffsetTop: number,
    imageScale: number,
    calculatedWidth: number,
    baseWidth: number
  ): boolean {
    return isV1TopMappingDegenerateUtil(
      markers,
      viewOffsetTop,
      imageScale,
      calculatedWidth,
      baseWidth
    );
  }

  /**
   * V1 방식: top 값 기반 위치 계산
   * @param top - 원본 top 값 (460px 기준)
   * @param imageScale - 이미지 스케일 (2/3 * 화면너비/460)
   * @param viewOffsetTop - 뷰 오프셋
   * @param calculatedWidth - 실제 계산된 화면 너비
   * @param baseWidth - 기준 너비 (460px)
   */
  static calculateViewTopV1(
    top: number,
    imageScale: number,
    viewOffsetTop: number,
    calculatedWidth: number = CARTOON_IMAGE_WIDTH_BASE,
    baseWidth: number = CARTOON_IMAGE_WIDTH_BASE
  ): number {
    // 화면 크기 비율 계산 (V0 방식 참고)
    const screenRatio = calculatedWidth / baseWidth;

    // top 값을 현재 화면 크기에 맞게 조정
    const adjustedTop = top * screenRatio;

    return -viewOffsetTop + adjustedTop * imageScale;
  }

  /**
   * V0 방식: positionRatio 기반 위치 계산
   */
  static calculatePositionV0(positionRatio: number, imageHeight: number): number {
    return (positionRatio / 100) * imageHeight;
  }

  /**
   * V1: 현재 타임라인 시간 가져오기 (top 기반)
   * @param scrollTop - 현재 스크롤 위치
   * @param markers - 마커 배열
   * @param viewOffsetTop - 뷰 오프셋
   * @param imageScale - 이미지 스케일
   * @param calculatedWidth - 실제 계산된 화면 너비
   * @param baseWidth - 기준 너비 (460px)
   */
  static getTimeLineMsV1(
    scrollTop: number,
    markers: any[],
    viewOffsetTop: number,
    imageScale: number,
    calculatedWidth: number = CARTOON_IMAGE_WIDTH_BASE,
    baseWidth: number = CARTOON_IMAGE_WIDTH_BASE,
    /** V0 폴백: scrollTop/scrollHeight → positionRatio 에 사용 (전체 scrollHeight) */
    contentScrollHeight: number = 0,
    /** 선형 폴백: scrollTop 비율 분모 (보통 scrollHeight - clientHeight) */
    scrollRange: number = 0
  ): number {
    if (!markers || markers.length === 0) return 0;

    if (scrollTop <= 0) return 0;

    // 화면 크기 비율 계산 (실제 너비 / 기준 너비)
    const screenRatio = calculatedWidth / baseWidth;

    // 디버깅: 호출 시 파라미터 로그
    playerLogger.log(`[getTimeLineMsV1] scrollTop: ${scrollTop.toFixed(2)}, calculatedWidth: ${calculatedWidth.toFixed(2)}, baseWidth: ${baseWidth}, screenRatio: ${screenRatio.toFixed(4)}, imageScale: ${imageScale.toFixed(4)}, viewOffsetTop: ${viewOffsetTop.toFixed(2)}, contentScrollHeight: ${contentScrollHeight.toFixed(2)}, scrollRange: ${scrollRange.toFixed(2)}`);

    if (
      PositionCalculator.isV1TopMappingDegenerate(
        markers,
        viewOffsetTop,
        imageScale,
        calculatedWidth,
        baseWidth
      )
    ) {
      const degenerateKind = classifyV1TopDegenerateMapping(markers, contentScrollHeight);
      if (degenerateKind === "no-content-height") {
        playerLogger.warn(
          '[getTimeLineMsV1] V1 spoint top 매핑이 붕괴 상태인데 contentScrollHeight(scrollHeight)가 없습니다.'
        );
        return 0;
      }
      if (degenerateKind === "v0-position-ratios") {
        return PositionCalculator.getTimeLineMsV0(scrollTop, contentScrollHeight, markers);
      }
      return timeLineMsV1LinearFallback(
        scrollTop,
        markers,
        Math.max(1, scrollRange || contentScrollHeight)
      );
    }

    /**
     * `getPositionAtTimeV1`과 동일한 매핑의 역: 두 키 사이 스크롤에서도 **보간된 ms**를 돌려야 재생 시 대사가 다음 줄로 밀리지 않음.
     * (옛 구현: 픽셀 정렬 후 `px >= scrollTop`인 **첫** 마커 time_ms → 항상 **다음** 키에 해당하는 시간이 됨)
     */
    const posAt = (t: number) =>
      PositionCalculator.getPositionAtTimeV1(
        t,
        markers,
        imageScale,
        viewOffsetTop,
        scrollTop,
        calculatedWidth,
        baseWidth,
        scrollRange,
        contentScrollHeight,
      );

    const spoints = [...markers].sort((a, b) => (a.time_ms ?? 0) - (b.time_ms ?? 0));
    const tMin = spoints[0]?.time_ms ?? 0;
    const tMax = spoints[spoints.length - 1]?.time_ms ?? 0;
    const pLo = posAt(tMin);
    const pHi = posAt(tMax);
    const increasing = pLo <= pHi;

    if (increasing) {
      if (scrollTop <= pLo) return tMin;
      if (scrollTop >= pHi) return tMax;
      let lo = tMin;
      let hi = tMax;
      for (let i = 0; i < 48; i++) {
        const mid = (lo + hi) / 2;
        const pMid = posAt(mid);
        if (pMid < scrollTop) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }

    if (scrollTop >= pLo) return tMin;
    if (scrollTop <= pHi) return tMax;
    let lo = tMin;
    let hi = tMax;
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      const pMid = posAt(mid);
      if (pMid > scrollTop) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /**
   * V0: 현재 타임라인 시간 가져오기 (positionRatio 기반)
   */
  static getTimeLineMsV0(
    scrollTop: number,
    scrollHeight: number,
    markers: any[]
  ): number {
    if (scrollTop === 0) return 0;
    if (!markers || markers.length === 0) return 0;

    const denom = Math.max(1e-9, scrollHeight);
    const currentRatio = (scrollTop / denom) * 100;

    const sorted = [...markers].sort((a, b) => {
      const ra = a.positionRatio ?? 0;
      const rb = b.positionRatio ?? 0;
      if (Math.abs(ra - rb) > 1e-9) return ra - rb;
      return (a.time_ms ?? 0) - (b.time_ms ?? 0);
    });

    const rFirst = sorted[0].positionRatio ?? 0;
    const rLast = sorted[sorted.length - 1].positionRatio ?? 0;
    const tFirst = sorted[0].time_ms ?? 0;
    const tLast = sorted[sorted.length - 1].time_ms ?? 0;

    // 모든 마커가 같은 positionRatio면 스크롤 진행으로 time 축만 선형 매핑
    if (Math.abs(rLast - rFirst) < 1e-6) {
      const ratio = Math.min(1, Math.max(0, scrollTop / denom));
      if (sorted.length === 1) return ratio * Math.max(0, tFirst);
      if (tLast <= tFirst) return tFirst;
      return tFirst + ratio * (tLast - tFirst);
    }

    if (currentRatio <= rFirst) {
      if (rFirst <= 1e-9) return tFirst;
      const u = Math.min(1, Math.max(0, currentRatio / rFirst));
      return 0 + (tFirst - 0) * u;
    }

    if (currentRatio >= rLast) {
      return tLast;
    }

    let i = -1;
    for (let k = 0; k < sorted.length; k++) {
      if ((sorted[k].positionRatio ?? 0) <= currentRatio) i = k;
      else break;
    }

    if (i < 0) return tFirst;
    if (i >= sorted.length - 1) return tLast;

    const cur = sorted[i];
    const nxt = sorted[i + 1];
    const r0 = cur.positionRatio ?? 0;
    const r1 = nxt.positionRatio ?? 0;
    const t0 = cur.time_ms ?? 0;
    const t1 = nxt.time_ms ?? 0;
    if (r1 <= r0) return t0;
    const u = Math.min(1, Math.max(0, (currentRatio - r0) / (r1 - r0)));
    return t0 + (t1 - t0) * u;
  }

  /**
   * V1: 특정 시간의 스크롤 위치 계산 (top 기반)
   * @param virtualTimeMs - 가상 시간 (밀리초)
   * @param markers - 마커 배열
   * @param imageScale - 이미지 스케일
   * @param viewOffsetTop - 뷰 오프셋
   * @param currentScrollTop - 현재 스크롤 위치
   * @param calculatedWidth - 실제 계산된 화면 너비
   * @param baseWidth - 기준 너비 (460px)
   */
  static getPositionAtTimeV1(
    virtualTimeMs: number,
    markers: any[],
    imageScale: number,
    viewOffsetTop: number,
    currentScrollTop: number,
    calculatedWidth: number = CARTOON_IMAGE_WIDTH_BASE,
    baseWidth: number = CARTOON_IMAGE_WIDTH_BASE,
    scrollRange: number = 0,
    v0ContentScrollHeight: number = 0
  ): number {
    if (!markers || markers.length === 0) {
      return currentScrollTop;
    }

    // 화면 크기 비율 계산 (실제 너비 / 기준 너비)
    const screenRatio = calculatedWidth / baseWidth;

    // 디버깅 로그 추가
    if (Math.random() < 0.01) { // 1% 확률로 로그 (너무 많이 찍히는 것 방지)
      playerLogger.log(`[getPositionAtTimeV1] calculatedWidth: ${calculatedWidth.toFixed(2)}, baseWidth: ${baseWidth}, screenRatio: ${screenRatio.toFixed(4)}, imageScale: ${imageScale.toFixed(4)}, viewOffsetTop: ${viewOffsetTop.toFixed(2)}, scrollRange: ${scrollRange.toFixed(2)}, v0ContentScrollHeight: ${v0ContentScrollHeight.toFixed(2)}`);
    }

    if (
      PositionCalculator.isV1TopMappingDegenerate(
        markers,
        viewOffsetTop,
        imageScale,
        calculatedWidth,
        baseWidth
      )
    ) {
      const degenerateKind = classifyV1TopDegenerateMapping(markers, v0ContentScrollHeight);
      if (degenerateKind === "no-content-height") {
        playerLogger.warn(
          '[getPositionAtTimeV1] V1 spoint top 매핑이 붕괴 상태인데 v0ContentScrollHeight(scrollHeight)가 없습니다. calculateViewTop 폴백 사용.'
        );
        return v1FirstMarkerScrollTop(
          markers,
          calculatedWidth,
          baseWidth,
          viewOffsetTop,
          imageScale
        );
      }
      if (degenerateKind === "v0-position-ratios") {
        return PositionCalculator.getPositionAtTimeV0(
          virtualTimeMs,
          markers,
          v0ContentScrollHeight,
          currentScrollTop
        );
      }
      return positionAtTimeV1LinearFallback(
        virtualTimeMs,
        markers,
        Math.max(1, scrollRange || v0ContentScrollHeight)
      );
    }

    const calculateViewTop = (top: number) => {
      // top 값을 현재 화면 크기에 맞게 조정 (V0 방식 참고)
      const adjustedTop = top * screenRatio;
      return -viewOffsetTop + adjustedTop * imageScale;
    };

    const spoints = [...markers].sort((a, b) => (a.time_ms ?? 0) - (b.time_ms ?? 0));

    if (virtualTimeMs < (spoints[0].time_ms ?? 0)) {
      return calculateViewTop(spoints[0].top ?? 0);
    }

    if (virtualTimeMs >= (spoints[spoints.length - 1].time_ms ?? 0)) {
      return calculateViewTop(spoints[spoints.length - 1].top ?? 0);
    }

    let low = 0;
    let high = spoints.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      if (
        mid === spoints.length - 1 ||
        (virtualTimeMs >= (spoints[mid].time_ms ?? 0) && virtualTimeMs < (spoints[mid + 1].time_ms ?? 0))
      ) {
        const current = spoints[mid];
        const next = spoints[mid + 1];

        const segmentStart = current.time_ms ?? 0;
        const segmentEnd = next.time_ms ?? 0;
        const totalDuration = segmentEnd - segmentStart;
        const segmentElapsed = virtualTimeMs - segmentStart;

        const transitionEffect = current.transition_effect || { before_ms: 0, after_ms: 0 };
        const beforeDelay = transitionEffect.before_ms || 0;
        const afterDelay = transitionEffect.after_ms || 0;

        if (segmentElapsed < beforeDelay) {
          return calculateViewTop(current.top ?? 0);
        } else if (segmentElapsed > totalDuration - afterDelay) {
          return calculateViewTop(next.top ?? 0);
        } else {
          const animStartTime = segmentStart + beforeDelay;
          const animEndTime = segmentEnd - afterDelay;
          const animDuration = animEndTime - animStartTime;
          const animProgress = Math.min(
            1,
            Math.max(0, (virtualTimeMs - animStartTime) / animDuration)
          );

          const scrollTop = (current.top ?? 0) + ((next.top ?? 0) - (current.top ?? 0)) * animProgress;
          return calculateViewTop(scrollTop);
        }
      }

      if (virtualTimeMs < (spoints[mid].time_ms ?? 0)) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return calculateViewTop(spoints[0].top ?? 0);
  }

  /**
   * V0: 특정 시간의 스크롤 위치 계산 (positionRatio 기반)
   */
  static getPositionAtTimeV0(
    virtualTimeMs: number,
    markers: any[],
    imageHeight: number,
    currentScrollTop: number
  ): number {
    if (!markers || markers.length === 0) {
      return currentScrollTop;
    }

    const spoints = [...markers].sort((a, b) => (a.time_ms ?? 0) - (b.time_ms ?? 0));

    if (virtualTimeMs < (spoints[0].time_ms ?? 0)) {
      return ((spoints[0].positionRatio ?? 0) / 100) * imageHeight;
    }

    if (virtualTimeMs >= (spoints[spoints.length - 1].time_ms ?? 0)) {
      return ((spoints[spoints.length - 1].positionRatio ?? 0) / 100) * imageHeight;
    }

    let low = 0;
    let high = spoints.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      if (
        mid === spoints.length - 1 ||
        (virtualTimeMs >= (spoints[mid].time_ms ?? 0) && virtualTimeMs < (spoints[mid + 1].time_ms ?? 0))
      ) {
        const current = spoints[mid];
        const next = spoints[mid + 1];

        const segmentStart = current.time_ms ?? 0;
        const segmentEnd = next.time_ms ?? 0;
        const totalDuration = segmentEnd - segmentStart;
        const segmentElapsed = virtualTimeMs - segmentStart;

        const transitionEffect = current.transition_effect || { before_ms: 0, after_ms: 0 };
        const beforeDelay = transitionEffect.before_ms || 0;
        const afterDelay = transitionEffect.after_ms || 0;

        if (segmentElapsed < beforeDelay) {
          return ((current.positionRatio ?? 0) / 100) * imageHeight;
        } else if (segmentElapsed > totalDuration - afterDelay) {
          return ((next.positionRatio ?? 0) / 100) * imageHeight;
        } else {
          const animStartTime = segmentStart + beforeDelay;
          const animEndTime = segmentEnd - afterDelay;
          const animDuration = animEndTime - animStartTime;
          const animProgress = Math.min(
            1,
            Math.max(0, (virtualTimeMs - animStartTime) / animDuration)
          );

          const currentPos = current.positionRatio ?? 0;
          const nextPos = next.positionRatio ?? 0;
          const interpolatedRatio = currentPos + (nextPos - currentPos) * animProgress;
          return (interpolatedRatio / 100) * imageHeight;
        }
      }

      if (virtualTimeMs < (spoints[mid].time_ms ?? 0)) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return ((spoints[0].positionRatio ?? 0) / 100) * imageHeight;
  }
}
