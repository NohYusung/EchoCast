/* eslint-disable @typescript-eslint/no-explicit-any */
/*
    useToonWork.ts
    Unified Toon player management hook for React + Next.js
    Supports both V0 and V1 content versions
    Author : Kendrick Kim(kjkim@mobipintech.com)
    Refactored for unified version support
    Last update : 2025-11-30
*/

import { useState, useCallback, useRef, useEffect } from 'react';
import { createShockWave, ShockWaveInstance } from './useShockWave';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useRecordingStore } from '@/stores/useRecordingStore';
import type { RecordingData } from '@/app/player/_lib/recordingStorage';
import { playerLogger } from './playerLogger';
import { getMediaUrl, getFetchUrl } from '@/lib/environment';
import {
  canBrowserPlayRecordingMimeType,
  inferEpisodeRecordingMimeType,
  resolveEpisodeRecordingAudioUrl,
  uuidAliasKeys,
} from '@/api/episodeRecordings';
import {
  devLog,
  devError,
  debugVoiceLog,
  AudioController,
  EffectProcessor,
  DOMHelper,
  TimerHelper,
  PlayerControlHelper,
  SpointMappingHelper,
  SetupHelper,
  PositionCalculator, CARTOON_IMAGE_WIDTH_BASE, CARTOON_IMAGE_WIDTH_BASE_SIZE,
} from './toonWorkCommon';
import {PurchaseCasting} from "@/models/playerData";

interface ShockWaveWrapper {
  character_uuid?: string;
  audio_uuid?: string;
  hole?: any;
  record?: any;
  shockWave: ShockWaveInstance;
  clip?: any;
  /** audio_tracks.track.graph — 클립 graph와 곱해져 DubRight식 트랙 자동화로 적용 */
  trackGraph?: unknown;
  timer: NodeJS.Timeout | null;
}

interface ToonWorkRef {
  playEffect?: (effect: any, immediate: boolean, delay: number, playSpeed: number) => void;
  stopAllEffects?: () => void;
}

export type ContentVersion = 'V0' | 'V1' | 'V2' | 'V3';

export type RecordingSite = 'edu' | 'kids' | 'senior';

interface UseToonWorkOptions {
  version?: ContentVersion;
  /** 도메인별 녹음 분리 (미지정 시 공통 키 사용) */
  site?: RecordingSite;
  /** true면 localStorage 녹음 로드를 건너뛴다(시범 모드 메모리 전용). */
  skipStoredRecordings?: boolean;
  /**
   * 로컬 녹음 스토리지 키 `edu_${id}` 등에 쓰는 에피소드 id.
   * 미지정 시 0 — PlayerContent에서는 URL/헤더에서 해석한 id를 넘길 것.
   */
  recordingEpisodeId?: number;
  onComplete?: () => void;
  onProgressUpdate?: (progress: { step: string; percentage: number }) => void;
}

/**
 * `duration_ms`에서 `trim_left_ms` / `trim_right_ms`를 뺀 실제 재생 길이(ms).
 * trim 값이 0이면 그 항은 빼지 않음(=0만큼 감소). 0이 아닐 때만 해당 ms만큼 `duration_ms`에서 차감.
 */
function effectiveAudioClipDurationMs(clip: {
  duration_ms?: number;
  trim_left_ms?: number;
  trim_right_ms?: number;
}): number {
  const baseRaw = Number(clip.duration_ms);
  const base = Number.isFinite(baseRaw) ? baseRaw : 0;

  const subTrim = (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return 0;
    return n;
  };

  return Math.max(0, base - subTrim(clip.trim_left_ms) - subTrim(clip.trim_right_ms));
}

type AudioGraphPoint = [number, number];

/** DubRight VOLUME.MAX_PERCENT(200) 등: Y가 퍼센트면 /100 후 linear 최대 2 */
const DUBRIGHT_MAX_PERCENT_LINEAR = 2;

function normalizeDubrightGraphY(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  if (n > 1.5) {
    return Math.max(0, Math.min(DUBRIGHT_MAX_PERCENT_LINEAR, n / 100));
  }
  return Math.max(0, Math.min(1, n));
}

const INV_POINT = -999;
const BEZIER_SAMPLE_COUNT = 16;

function rawGraphPointData(graph: unknown): unknown[] | null {
  const pointData: unknown =
    Array.isArray(graph) ? graph : (graph && typeof graph === 'object' ? (graph as any).point_data : null);
  return Array.isArray(pointData) ? pointData : null;
}

/**
 * curve_start/end_point_data에서 유효한 베지어 제어점을 꺼낸다.
 * [-999, -999] 이하면 null (직선 처리).
 */
function extractCurveControlPoint(raw: unknown): [number, number] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const cx = Number(raw[0]);
  const cy = Number(raw[1]);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  if (cx <= INV_POINT || cy <= INV_POINT) return null;
  return [cx, cy];
}

/**
 * 2차 베지어 곡선을 BEZIER_SAMPLE_COUNT개 점으로 샘플링.
 * p0, p1, p2는 모두 [x%, y%] 퍼센트 좌표.
 * 반환: { localMs, rawY }[] (clipDurationMs 기준 ms 변환 포함)
 */
function sampleQuadraticBezier(
  p0: [number, number],
  ctrl: [number, number],
  p1: [number, number],
  clipDurationMs: number,
): Array<{ localMs: number; rawY: number }> {
  const out: Array<{ localMs: number; rawY: number }> = [];
  for (let i = 0; i <= BEZIER_SAMPLE_COUNT; i++) {
    const t = i / BEZIER_SAMPLE_COUNT;
    const mt = 1 - t;
    const x = mt * mt * p0[0] + 2 * mt * t * ctrl[0] + t * t * p1[0];
    const y = mt * mt * p0[1] + 2 * mt * t * ctrl[1] + t * t * p1[1];
    const localMs = Math.max(0, Math.min(clipDurationMs, (x / 100) * clipDurationMs));
    out.push({ localMs, rawY: y });
  }
  return out;
}

/** 트랙 자동화: [[globalMs, y], ...] */
function extractTrackGraphKnots(trackGraph: unknown): Array<{ globalMs: number; y: number }> {
  if (!Array.isArray(trackGraph)) return [];
  const out: Array<{ globalMs: number; y: number }> = [];
  for (const p of trackGraph as any[]) {
    const x = Number(p?.[0]);
    const y = Number(p?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ globalMs: x, y });
  }
  out.sort((a, b) => a.globalMs - b.globalMs);
  return out;
}

/**
 * 클립 그래프 좌표 → 클립 로컬 ms, 원시 Y
 * (DubRight clip.graph: point_data 퍼센트 또는 ms)
 * curve_start/end_point_data가 유효하면 페이드인/아웃 구간을 2차 베지어로 샘플링.
 */
function extractClipGraphLocalKnots(
  graph: unknown,
  clipStartMs: number,
  clipDurationMs: number,
): Array<{ localMs: number; rawY: unknown }> {
  const pointData = rawGraphPointData(graph);
  if (!pointData || pointData.length === 0 || !Number.isFinite(clipDurationMs) || clipDurationMs <= 0) {
    return [];
  }

  const xs = pointData
    .map((p: any) => Number(p?.[0]))
    .filter((n: number) => Number.isFinite(n));
  const maxX = xs.length ? Math.max(...xs) : 0;

  const isPercentX = maxX > 0 && maxX <= 100;
  const seemsTimelineMs = !isPercentX && maxX > clipDurationMs + 1000 && maxX > clipStartMs;

  // point_data를 [xPercent, y] 배열로 정규화
  const percentPoints: Array<[number, number]> = [];
  for (const p of pointData as any[]) {
    const xRaw = Number(p?.[0]);
    const yRaw = Number(p?.[1]);
    if (!Number.isFinite(xRaw)) continue;

    let xPct: number;
    if (isPercentX) {
      xPct = xRaw;
    } else if (seemsTimelineMs) {
      xPct = ((xRaw - clipStartMs) / clipDurationMs) * 100;
    } else {
      xPct = (xRaw / clipDurationMs) * 100;
    }
    percentPoints.push([Math.max(0, Math.min(100, xPct)), yRaw]);
  }
  percentPoints.sort((a, b) => a[0] - b[0]);

  // curve_start/end_point_data (베지어 제어점)
  const graphObj = graph && typeof graph === 'object' && !Array.isArray(graph) ? graph as any : null;
  const curveStart = graphObj ? extractCurveControlPoint(graphObj.curve_start_point_data) : null;
  const curveEnd = graphObj ? extractCurveControlPoint(graphObj.curve_end_point_data) : null;

  // point_data가 정확히 4개이고 퍼센트 X일 때만 베지어 적용 (DubRight VolumeFadeGraph 포맷)
  const canApplyBezier = isPercentX && percentPoints.length === 4;

  const knots: Array<{ localMs: number; rawY: unknown }> = [];

  if (canApplyBezier) {
    const [p0, p1, p2, p3] = percentPoints;

    // 페이드인 구간 (0→1): 베지어 또는 직선
    if (curveStart) {
      const samples = sampleQuadraticBezier(p0, curveStart, p1, clipDurationMs);
      for (const s of samples) knots.push(s);
    } else {
      knots.push({ localMs: (p0[0] / 100) * clipDurationMs, rawY: p0[1] });
      knots.push({ localMs: (p1[0] / 100) * clipDurationMs, rawY: p1[1] });
    }

    // sustain 구간 (1→2): 항상 직선
    knots.push({ localMs: (p2[0] / 100) * clipDurationMs, rawY: p2[1] });

    // 페이드아웃 구간 (2→3): 베지어 또는 직선
    if (curveEnd) {
      const samples = sampleQuadraticBezier(p2, curveEnd, p3, clipDurationMs);
      for (const s of samples) knots.push(s);
    } else {
      knots.push({ localMs: (p3[0] / 100) * clipDurationMs, rawY: p3[1] });
    }
  } else {
    // 기존 방식: point_data 그대로 선형 knot
    for (const [xPct, yRaw] of percentPoints) {
      const localMs = Math.max(0, Math.min(clipDurationMs, (xPct / 100) * clipDurationMs));
      knots.push({ localMs, rawY: yRaw });
    }
  }

  knots.sort((a, b) => a.localMs - b.localMs);
  return knots;
}

function interpolateNormalizedGraphGain(
  knots: Array<{ t: number; rawY: unknown }>,
  tQuery: number,
): number {
  if (knots.length === 0) return 1;
  if (knots.length === 1) return normalizeDubrightGraphY(knots[0].rawY);
  if (tQuery <= knots[0].t) return normalizeDubrightGraphY(knots[0].rawY);
  const last = knots[knots.length - 1];
  if (tQuery >= last.t) return normalizeDubrightGraphY(last.rawY);

  let i = 0;
  while (i < knots.length - 1 && knots[i + 1].t < tQuery) i += 1;
  const p0 = knots[i];
  const p1 = knots[i + 1];
  const g0 = normalizeDubrightGraphY(p0.rawY);
  const g1 = normalizeDubrightGraphY(p1.rawY);
  const dt = p1.t - p0.t;
  if (dt <= 0) return g1;
  const u = (tQuery - p0.t) / dt;
  return g0 + u * (g1 - g0);
}

function trackAutomationGainAt(trackKnots: Array<{ globalMs: number; y: number }>, globalMs: number): number {
  if (trackKnots.length === 0) return 1;
  if (trackKnots.length === 1) return normalizeDubrightGraphY(trackKnots[0].y);
  return interpolateNormalizedGraphGain(
    trackKnots.map((k) => ({ t: k.globalMs, rawY: k.y })),
    globalMs,
  );
}

/**
 * 트랙 graph(글로벌 ms) × 클립 graph(로컬 ms) × 이후 baseGain(clip.volume) — DubRight와 동일한 층 곱.
 * 반환: [버퍼 절대 초, linearGain] (trimLeft 반영)
 */
function buildCombinedTrackClipEnvelopeSec(args: {
  trackGraph: unknown;
  clipGraph: unknown;
  clipStartMs: number;
  clipDurationMs: number;
  trimLeftMs: number;
}): AudioGraphPoint[] {
  const { trackGraph, clipGraph, clipStartMs, clipDurationMs, trimLeftMs } = args;
  const trimLeftSec = Number(trimLeftMs) / 1000;
  const dur = Number(clipDurationMs);
  if (!Number.isFinite(dur) || dur <= 0) return [];

  const trackKnots = extractTrackGraphKnots(trackGraph);
  const clipKnots = extractClipGraphLocalKnots(clipGraph, clipStartMs, dur);

  const hasTrackAutomation = trackKnots.length >= 1;
  const hasClipGraph = clipKnots.length > 0;

  if (!hasTrackAutomation && !hasClipGraph) return [];

  const localTimes = new Set<number>();
  localTimes.add(0);
  localTimes.add(dur);
  for (const k of clipKnots) {
    if (Number.isFinite(k.localMs)) localTimes.add(Math.max(0, Math.min(dur, k.localMs)));
  }
  if (hasTrackAutomation) {
    for (const tk of trackKnots) {
      const local = tk.globalMs - clipStartMs;
      if (Number.isFinite(local) && local >= 0 && local <= dur) localTimes.add(local);
    }
  }

  const sortedLocal = [...localTimes].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);

  const points: AudioGraphPoint[] = [];
  for (const localMs of sortedLocal) {
    const globalMs = clipStartMs + localMs;
    const gTrack = hasTrackAutomation ? trackAutomationGainAt(trackKnots, globalMs) : 1;
    const gClip = hasClipGraph ? interpolateNormalizedGraphGain(
      clipKnots.map((c) => ({ t: c.localMs, rawY: c.rawY })),
      localMs,
    ) : 1;
    const g = gTrack * gClip;
    points.push([trimLeftSec + localMs / 1000, g]);
  }

  points.sort((a, b) => a[0] - b[0]);
  return points;
}

/** clip.effects: [] | 객체 | 객체 배열 등 DubRight 스키마 방어 */
function normalizeClipEffectsForTone(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    const objects = raw.filter((x) => x != null && typeof x === 'object' && !Array.isArray(x)) as Record<
      string,
      unknown
    >[];
    if (objects.length === 0) return null;
    if (objects.length === 1) return objects[0]!;
    return objects.reduce((acc, o) => ({ ...acc, ...o }), {} as Record<string, unknown>);
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return null;
}

// --- Main Hook ---
export function useToonWork(options: UseToonWorkOptions = {}) {
  const {
    version = 'V1',
    site,
    skipStoredRecordings = false,
    recordingEpisodeId = 0,
    onComplete,
    onProgressUpdate,
  } = options;
  const playerStore = usePlayerStore();
  const loadRecordings = useRecordingStore((s) => s.loadRecordings);

  // --- Constants ---
  const cartoonImageWidthCustom = CARTOON_IMAGE_WIDTH_BASE_SIZE;
  const cartoonImageWidthBase = CARTOON_IMAGE_WIDTH_BASE;
  const imageWidthScaleBase = 2 / 3;

  // --- V0 전용 Refs ---
  const actxRef = useRef<AudioContext | null>(null);
  const decodedAudioDataPoolRef = useRef<Record<string, AudioBuffer>>({});
  const dubbingPoolRef = useRef<Record<string, any>>({});
  const bufferSourcePoolRef = useRef<Record<string, AudioBufferSourceNode>>({});
  const frameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loadScriptTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tsStartAtRef = useRef(-1);
  const lastTSDiffRef = useRef(0);
  const currentMarkerIdxRef = useRef(0);
  const lastFiredScriptIdxRef = useRef(0);
  const lastLoadedScriptIndexRef = useRef(0);
  const lastProgressMessageRef = useRef("");
  const soundEffectsInfoRef = useRef<any[]>([]);
  const producedContentInfoRef = useRef<any>({});
  const approvedParticipantInfoRef = useRef<any[]>([]);
  const markerListRef = useRef<any[]>([]);
  const scriptListRef = useRef<any[]>([]);
  const scrollTargetRef = useRef<HTMLDivElement>(null);
  const imgsRef = useRef<HTMLDivElement>(null);

  // --- State ---
  const [playSpeed] = useState<number>(1.0);
  const [episode, setEpisode] = useState<any>({});
  const [images, setImages] = useState<any[]>([]);
  const [clearTextImages, setClearTextImages] = useState<any[]>([]);
  const [contentData, setContentData] = useState<any>({});
  const [spointMappingData, setSpointMappingData] = useState<any[]>([]);
  const [voiceShockWaves, setVoiceShockWaves] = useState<any[]>([]);
  const [audioShockWaves, setAudioShockWaves] = useState<any[]>([]);
  const [markers, setMarkers] = useState<any[]>([]);
  const [effects, setEffects] = useState<any[]>([]);
  const [isStop, setIsStop] = useState(true);
  const [loadingCount, setLoadingCount] = useState(0);
  const [loadingCompleteCalled, setLoadingCompleteCalled] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationProgress, setInitializationProgress] = useState({
    step: '',
    percentage: 0
  });
  const [failedResources, setFailedResources] = useState<{
    audio: string[];
    voice: string[];
    image: string[];
  }>({
    audio: [],
    voice: [],
    image: []
  });
  const [, setCartoonImageWidth] = useState(cartoonImageWidthBase);
  const [cartoonImageWidthOriginal] = useState(cartoonImageWidthBase);
  const [imageWidthScale, setImageWidthScale] = useState(imageWidthScaleBase);
  const [calculatedWidth, setCalculatedWidth] = useState(cartoonImageWidthBase);
  const [calculatedWidthCustom, setCalculatedWidthCustom] = useState(cartoonImageWidthCustom);
  const [workspaceOptions, setWorkspaceOptions] = useState<any>({
    image_scale: imageWidthScaleBase,
    work_type: 'player',
    calculatedWidth: cartoonImageWidthBase,
  });
  const [isMuted, setIsMuted] = useState(false);

  // --- Progress Update Helper ---
  // 각 단계별 진행률: 이미지(0-25%), 보이스(25-50%), 사운드(50-75%), 최종초기화(75-100%)
  const updateProgress = useCallback((progress: { step: string; percentage: number }) => {
    setInitializationProgress(progress);
    if (onProgressUpdate) {
      onProgressUpdate(progress);
    }
  }, [onProgressUpdate]);

  // --- Refs ---
  const toonBoxRef = useRef<HTMLElement | null>(null);
  const toonWorkRef = useRef<ToonWorkRef | null>(null);
  const tmrSpointsRef = useRef<Array<{ clear: () => void } | number>>([]);
  const shouldStopAllAnimationsRef = useRef(false);
  const isMutedRef = useRef(false);
  const overrideArtistNosRef = useRef<number[] | null>(null);
  const overrideCharacterUUIDsRef = useRef<string[] | null>(null);

  // --- Computed Values ---
  const newViewOffsetTop = useCallback(() => {
    const top = cartoonImageWidthOriginal * imageWidthScale * (16 / 9) * 0.1;
    return top;
  }, [cartoonImageWidthOriginal, imageWidthScale]);

  // --- Effects ---
  useEffect(() => {
    if (loadingCount === 0 && !loadingCompleteCalled) {
      setLoadingCompleteCalled(true);
      onLoadingComplete();
    }
  }, [loadingCount, loadingCompleteCalled]);

  // isMuted 상태가 변경될 때 ref도 동기화
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // --- Private Methods ---
  function onLoadingComplete() {
    devLog('Loading complete');
  }

  const setDisplayWidth = useCallback(() => {
    // V1: 9:16 비율을 유지하면서 460px 기준으로 계산
    // V0: 기존 로직 유지 (화면 너비 기준)
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const maxWidthByHeight = windowHeight * 9 / 16;

    const width = version !== 'V0'
      ? Math.min(windowWidth, maxWidthByHeight, cartoonImageWidthBase)
      : Math.min(windowWidth, cartoonImageWidthBase);

    playerLogger.log(`[setDisplayWidth] Version: ${version}, Window: ${windowWidth}x${windowHeight}, Max by height (9:16): ${maxWidthByHeight.toFixed(2)}, Calculated: ${width.toFixed(2)}`);

    setCalculatedWidth(width);
    setCartoonImageWidth(width);

    // Custom width도 동일한 로직 적용
    const widthCustom = version !== 'V0'
      ? Math.min(windowWidth, maxWidthByHeight, cartoonImageWidthCustom)
      : Math.min(windowWidth, cartoonImageWidthCustom);

    setCalculatedWidthCustom(widthCustom);

    // 계산된 값을 반환 (handleResize에서 즉시 사용하기 위해)
    return width;
  }, [cartoonImageWidthBase, cartoonImageWidthCustom, version]);

  const handleResize = useCallback(() => {
    // setDisplayWidth()가 계산한 width를 즉시 받아서 사용 (setState 비동기 문제 해결)
    const newCalculatedWidth = setDisplayWidth();

    // V1: imageScale 고정, V0: 화면 비율 적용
    const newScale = version !== 'V0'
      ? imageWidthScaleBase
      : imageWidthScaleBase * (newCalculatedWidth / cartoonImageWidthBase);

    playerLogger.log(`[handleResize] Version: ${version}, Width: ${newCalculatedWidth.toFixed(2)}, Scale: ${newScale.toFixed(4)}`);

    setImageWidthScale(newScale);
    setWorkspaceOptions((prev: any) => ({
      ...prev,
      image_scale: newScale,
      calculatedWidth: newCalculatedWidth,
    }));
  }, [setDisplayWidth, version, cartoonImageWidthBase, imageWidthScaleBase]);

  const setupEffects = useCallback(
    async (content: any, playSpeedVal = 1.0) => {
      const newEffects = await SetupHelper.setupEffects(content, playSpeedVal);
      setEffects(newEffects);
      return newEffects;
    },
    []
  );

  const setupMarker = useCallback(async (content: any) => {
    const newMarkers = await SetupHelper.setupMarkers(content);
    setMarkers(newMarkers);
    return newMarkers;
  }, []);

  const setupAudio = useCallback(async (content: any, onProgress?: (loaded: number, total: number) => void) => {
    setLoadingCount((prev) => prev + 1);

    const newAudioShockWaves: ShockWaveWrapper[] = [];
    const failedAudios: string[] = [];

    try {
      if (content.audio_tracks) {
        const audioCount = content.audio_tracks.reduce((acc: number, track: any) => acc + (track.clips?.length ?? 0), 0);
        playerLogger.log(`[setupAudio] 오디오 ${audioCount}개 로딩 시작`);

        let loadedCount = 0;
        onProgress?.(0, audioCount);

        for (const track of content.audio_tracks) {
          const clips = track.clips ?? [];
          for (const clip of clips) {
            const originalSrc = clip.url || clip.rawSrc || clip.src;
            try {
              const cachedUrl = playerStore.getCachedAudioUrl(originalSrc);
              const src = cachedUrl || (await playerStore.downloadAudio(originalSrc, "audio")) || getFetchUrl(getMediaUrl(originalSrc, "audio"));
              const effs = normalizeClipEffectsForTone(clip.effects);
              const shockWave = createShockWave();

              await shockWave.load(src, effs, false, 1.0);

              newAudioShockWaves.push({
                audio_uuid: track.uuid,
                trackGraph: track.graph,
                clip: {
                  ...clip,
                  start_ms: clip.start_ms ?? 0,
                  duration_ms: clip.duration_ms ?? 0,
                  effective_duration_ms: effectiveAudioClipDurationMs(clip),
                },
                shockWave: shockWave,
                timer: null,
              });
            } catch (e) {
              devError('오디오 로딩 실패:', originalSrc, e);
              failedAudios.push(originalSrc);
              // 실패해도 계속 진행
            }
            loadedCount++;
            onProgress?.(loadedCount, audioCount);
          }
        }

        playerLogger.log(`[setupAudio] 오디오 로딩 완료: ${newAudioShockWaves.length}개 성공, ${failedAudios.length}개 실패`);
        if (failedAudios.length > 0) {
          playerLogger.warn(`[setupAudio] 실패한 오디오 목록:`, failedAudios);
          setFailedResources(prev => ({
            ...prev,
            audio: [...prev.audio, ...failedAudios]
          }));
        }
      }
      setAudioShockWaves(newAudioShockWaves);
    } catch (error) {
      devError('오디오 셋업 중 오류:', error);
    } finally {
      setLoadingCount((prev) => prev - 1);
    }
    return newAudioShockWaves;
  }, [playerStore]);

  const getMergeEffect = useCallback((holeEffect: any | null = null, recordEffect: any | null = null) => {
    return EffectProcessor.mergeEffects(holeEffect, recordEffect);
  }, []);

  const verifyLoadingComplete = useCallback(() => {
    if (loadingCount === 0 && !loadingCompleteCalled) {
      setLoadingCompleteCalled(true);
      onLoadingComplete();
    }
  }, [loadingCount, loadingCompleteCalled]);

  const setupVoice = useCallback(
    async (content: any, playSpeedVal = 1.0, onProgress?: (loaded: number, total: number) => void) => {
      setLoadingCount((prev) => prev + 1);

      // 로컬 녹음 키는 site + recordingEpisodeId (PlayerContent가 URL/매핑 episodeId 전달)
      // 시범 모드에서는 브라우저 메모리만 사용하므로 storage 로드를 건너뛴다.
      if (!skipStoredRecordings) {
        loadRecordings(recordingEpisodeId, site);
      }
      const recordingStoreState = useRecordingStore.getState();
      const useUserRecording = recordingStoreState.useUserRecording;
      const appliedRecordings = useUserRecording ? recordingStoreState.getAppliedRecordings() : [];
      const recordingMap: Record<string, RecordingData> = {};
      const putRecordingForAliases = (r: RecordingData) => {
        for (const k of uuidAliasKeys(r.holeUuid)) {
          if (k) recordingMap[k] = r;
        }
      };
      appliedRecordings.forEach(putRecordingForAliases);

      // 서버에 저장된 녹음: 로컬「적용」이 없는 홀만 URL 재생 (hole.uuid 기준)
      if (useUserRecording) {
        const serverMap = recordingStoreState.serverRecordingsByHoleUuid;
        for (const holeUuid of Object.keys(serverMap)) {
          const hasLocalForHole = uuidAliasKeys(holeUuid).some((k) => Boolean(k && recordingMap[k]?.blobUrl));
          if (hasLocalForHole) continue;
          const src = serverMap[holeUuid]?.src;
          if (!src) continue;
          const url = resolveEpisodeRecordingAudioUrl(src);
          if (!url) continue;
          const mimeType = inferEpisodeRecordingMimeType(src);
          if (!canBrowserPlayRecordingMimeType(mimeType)) continue;
          putRecordingForAliases({
            holeUuid,
            blobUrl: url,
            blobData: '',
            mimeType,
            recordedAt: 0,
            durationMs: 0,
            isApply: true,
          });
        }
      }

      playerLogger.log(`[setupVoice] 이용자가 녹음한 녹음 데이터 수: ${appliedRecordings.length} / 적용 상태: ${useUserRecording}`);

      // 기존 shockWave 정리
      if (voiceShockWaves.length > 0) {
        playerLogger.log(`[setupVoice] 기존 보이스 ShockWave ${voiceShockWaves.length}개 정리 시작`);
        for (const shockWave of voiceShockWaves) {
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
        playerLogger.log(`[setupVoice] 기존 보이스 ShockWave 정리 완료`);
      }

      const newVoiceShockWaves: ShockWaveWrapper[] = [];
      const failedVoices: string[] = [];
      let mainCharacterLoadedCount = 0;
      let mainCharacterSkippedCount = 0;
      let supportingCharacterLoadedCount = 0;

      // 캐스팅에서 확인을 위한 전처리 (setState 비동기 문제 해결)
      const castingArtistNos = overrideArtistNosRef.current ?? [];
      const castingCharacterUUIDs = overrideCharacterUUIDsRef.current ?? [];

      debugVoiceLog(
        `캐스팅된 아티스트 수 : `, castingArtistNos.length,
      );
      debugVoiceLog(castingArtistNos);
      debugVoiceLog(
          `캐스팅의 캐릭터 UUID 수(주조연) : `, castingCharacterUUIDs.length,
      );
      debugVoiceLog(castingCharacterUUIDs);


      try {
        if (content.tracks) {
          // 총 보이스 개수 계산 (진행률 표시용)
          let totalVoiceCount = 0;
          const progressCounter = { loaded: 0 };
          for (const track of content.tracks) {
            const holesArr = track.holes ?? [];
            for (const hole of holesArr) {
              const records = hole.records ?? [];
              totalVoiceCount += records.length > 0 ? 1 : 0; // 각 hole당 최소 1개의 record 로드
            }
          }
          onProgress?.(0, totalVoiceCount);

          const updateVoiceProgress = () => {
            progressCounter.loaded++;
            onProgress?.(progressCounter.loaded, totalVoiceCount);
          };

          const VOICE_LOAD_CONCURRENCY = 6;
          const loadTasks: Array<() => Promise<void>> = [];

          const runWithConcurrency = async (
            tasks: Array<() => Promise<void>>,
            concurrency: number,
          ) => {
            const limit = Math.max(1, Math.floor(concurrency));
            let i = 0;
            const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
              while (i < tasks.length) {
                const idx = i++;
                await tasks[idx]!();
              }
            });
            await Promise.all(workers);
          };
          for (const track of content.tracks) {
            // 주조연 캐릭터 여부(주.조연시에는 artistId를 체크하여 해당 아티스트의 목소리가 나와야 함)
            const isCheckMainSupportCharacter = castingCharacterUUIDs.includes(track.character_uuid ?? ''); // 주조연 캐릭터 여부
            const holesArr = (track.holes ?? []).sort((a: any, b: any) => (a.start_ms ?? 0) - (b.start_ms ?? 0));
            for (const hole of holesArr) {
              const holeEffects = hole.effects;
              const records = hole.records ?? [];
              const startMs =
                (hole.start_ms ?? 0) > playSpeedVal ? (hole.start_ms ?? 0) / playSpeedVal : 0;
              const durationMs = hole.duration_ms ?? 0;
              const newHole = {
                ...hole,
                start_ms: startMs,
                duration_ms: durationMs,
                duration_ms_force: hole.duration_ms_force ?? durationMs,
              };

              debugVoiceLog(`Hole 시작 시간: ${startMs}ms, 총 레코드 수: ${records.length}`);

              if (records.length > 1) {
                debugVoiceLog(
                  `⚠️ 경고: Hole에 ${records.length}개의 레코드가 있습니다! (최대 1개만 허용)`,
                  `\n  - Hole 시작 시간: ${startMs}ms`,
                  `\n  - 캐릭터 UUID: ${track.character_uuid}`,
                  `\n  - 레코드 artist_no 목록:`, records.map((r: any) => r.artist_no),
                  `\n  ➡️ 첫 번째 레코드만 사용합니다.`
                );
              }

              playerLogger.log(`대사 : ${hole.script} / 캐릭터 UUID: ${track.character_uuid} / ${isCheckMainSupportCharacter ? '주조연' : '단역'}`);

              // pudding과 동일: hole마다 사용자 녹음 먼저 확인 → 있으면 그걸로만 로드 후 continue
              const userRecording =
                hole.uuid != null && String(hole.uuid).trim() !== ""
                  ? uuidAliasKeys(hole.uuid)
                      .map((k) => (k ? recordingMap[k] : undefined))
                      .find(Boolean) ?? null
                  : null;
              if (userRecording && userRecording.blobUrl) {
                playerLogger.log(`[setupVoice] 녹음 파일 사용 - holeUuid: ${hole.uuid}, script: ${hole.script}`);
                loadTasks.push(
                  () =>
                    new Promise<void>((resolve) => {
                      const shockWave = createShockWave();
                      shockWave
                        .load(userRecording.blobUrl, getMergeEffect(holeEffects, null), false, playSpeedVal)
                        .then((loaded) => {
                          if (!loaded) {
                            failedVoices.push(`recording:${hole.uuid}`);
                            updateVoiceProgress();
                            resolve();
                            return;
                          }
                          newVoiceShockWaves.push({
                            character_uuid: track.character_uuid,
                            hole: newHole,
                            record: { isUserRecording: true, holeUuid: hole.uuid },
                            shockWave: shockWave,
                            timer: null,
                          });
                          updateVoiceProgress();
                          resolve();
                        })
                        .catch((error) => {
                          devError('녹음 파일 로딩 실패:', hole.uuid, error);
                          failedVoices.push(`recording:${hole.uuid}`);
                          updateVoiceProgress();
                          resolve();
                        });
                    }),
                );
                continue;
              }

              if (isCheckMainSupportCharacter) {
                // 커플링을 위해 artist_no별로 로드 여부 추적
                const loadedArtistNos = new Set<number>();

                // 커플링 캐릭터 감지: castingArtistNos가 2개 이상이면 커플링
                const isCouplingCharacter = castingArtistNos.length > 1;

                playerLogger.log(`[setupVoice] 메인/조연 캐릭터 처리:`, {
                  characterUuid: track.character_uuid,
                  recordsCount: records.length,
                  castingArtistNos,
                  isCouplingCharacter,
                  records: records.map((r: any) => ({ artist_no: r.artist_no }))
                });
                for (const record of records) {
                  const artistNo = record.artist_no;
                  // 커플링 캐릭터인 경우 모든 레코드를 로드 (artist_no 체크 스킵)
                  const isSelected = isCouplingCharacter ? true : (artistNo && castingArtistNos.includes(artistNo));

                  playerLogger.log(`  레코드 전체 정보:`, {
                    artist_no: record.artist_no,
                    recordKeys: Object.keys(record),
                    record: record,
                    script: hole.script,
                    castingArtistNos,
                    isSelected
                  });

                  debugVoiceLog(
                    `  - 레코드 체크: artist_no=${artistNo}, ` +
                    `선택 여부=${isSelected ? '✅ 로드' : '❌ 스킵'}`
                  );

                  if (!artistNo || !isSelected) {
                    playerLogger.log(`    스킵: !artistNo=${!artistNo}, !isSelected=${!isSelected}`);
                    mainCharacterSkippedCount++;
                    continue;
                  }

                  // 같은 artist_no의 레코드는 한 번만 로드 (커플링 지원)
                  if (loadedArtistNos.has(artistNo)) {
                    debugVoiceLog(`    ⚠️ 스킵: artist_no ${artistNo}는 이미 로드했습니다.`);
                    playerLogger.log(`    중복 스킵: artist_no=${artistNo}`);
                    mainCharacterSkippedCount++;
                    continue;
                  }

                  playerLogger.log(`    ✅ 로드 진행: artist_no=${artistNo}`);

                  loadTasks.push(async () => {
                    const shockWave = createShockWave();
                    const originalSrc = record.url || record.rawSrc || record.src;
                    const cachedUrl = playerStore.getCachedAudioUrl(originalSrc);
                    const src = cachedUrl || (await playerStore.downloadAudio(originalSrc, "records")) || getFetchUrl(getMediaUrl(originalSrc, "records"));
                    const recordEffects = record.effects ?? null;

                    debugVoiceLog(`    ⏳ 로딩 시작: ${originalSrc.substring(originalSrc.lastIndexOf('/') + 1)}`);

                    try {
                      const loaded = await shockWave.load(
                        src,
                        getMergeEffect(holeEffects, recordEffects),
                        false,
                        playSpeedVal,
                      );
                      if (!loaded) {
                        failedVoices.push(originalSrc);
                        updateVoiceProgress();
                        return;
                      }
                      newVoiceShockWaves.push({
                        character_uuid: track.character_uuid,
                        hole: newHole,
                        record: record,
                        shockWave: shockWave,
                        timer: null,
                      });
                      mainCharacterLoadedCount++;
                      updateVoiceProgress();
                      debugVoiceLog(`    ✅ 로딩 완료: artist_no=${artistNo}`);
                    } catch (error) {
                      devError('음성 로딩 실패:', originalSrc, error);
                      debugVoiceLog(`    ❌ 로딩 실패: ${error}`);
                      failedVoices.push(originalSrc);
                      updateVoiceProgress();
                    }
                  });
                  loadedArtistNos.add(artistNo);
                  debugVoiceLog(`    📝 artist_no ${artistNo} 로드됨으로 표시 (현재 로드된 artist 수: ${loadedArtistNos.size})`);
                }

                // Fallback: 매칭되는 아티스트가 없는 경우 첫 번째 레코드를 강제로 로드
                if (loadedArtistNos.size === 0 && records.length > 0) {
                  const record = records[0];
                  playerLogger.log(`    ⚠️ [Fallback] 매칭되는 아티스트가 없어 첫 번째 레코드를 로드합니다: artist_no=${record.artist_no}`);

                  loadTasks.push(async () => {
                    const shockWave = createShockWave();
                    const originalSrc = record.url || record.rawSrc || record.src;
                    const cachedUrl = playerStore.getCachedAudioUrl(originalSrc);
                    const src = cachedUrl || (await playerStore.downloadAudio(originalSrc, "records")) || getFetchUrl(getMediaUrl(originalSrc, "records"));
                    const recordEffects = record.effects ?? null;

                    debugVoiceLog(`  - [Fallback] 레코드 로딩: ${originalSrc.substring(originalSrc.lastIndexOf('/') + 1)}`);

                    try {
                      const loaded = await shockWave.load(
                        src,
                        getMergeEffect(holeEffects, recordEffects),
                        false,
                        playSpeedVal,
                      );
                      if (!loaded) {
                        failedVoices.push(originalSrc);
                        updateVoiceProgress();
                        return;
                      }
                      newVoiceShockWaves.push({
                        character_uuid: track.character_uuid,
                        hole: newHole,
                        record: record,
                        shockWave: shockWave,
                        timer: null,
                      });
                      mainCharacterLoadedCount++;
                      updateVoiceProgress();
                      debugVoiceLog(`    ✅ [Fallback] 로딩 완료: artist_no=${record.artist_no}`);
                    } catch (error) {
                      devError('음성 로딩 실패 (Fallback):', originalSrc, error);
                      debugVoiceLog(`    ❌ [Fallback] 로딩 실패: ${error}`);
                      failedVoices.push(originalSrc);
                      updateVoiceProgress();
                    }
                  });
                }
              } else {
                playerLogger.log(hole.script);
                const record = records[0];

                if (record) {
                  loadTasks.push(async () => {
                    const shockWave = createShockWave();
                    const originalSrc = record.url || record.rawSrc || record.src;
                    const cachedUrl = playerStore.getCachedAudioUrl(originalSrc);
                    const src = cachedUrl || (await playerStore.downloadAudio(originalSrc, "records")) || getFetchUrl(getMediaUrl(originalSrc, "records"));
                    const recordEffects = record.effects ?? null;

                    debugVoiceLog(`  - 단역 레코드 로딩: ${originalSrc.substring(originalSrc.lastIndexOf('/') + 1)}`);

                    try {
                      const loaded = await shockWave.load(
                        src,
                        getMergeEffect(holeEffects, recordEffects),
                        false,
                        playSpeedVal,
                      );
                      if (!loaded) {
                        failedVoices.push(originalSrc);
                        updateVoiceProgress();
                        return;
                      }
                      newVoiceShockWaves.push({
                        character_uuid: track.character_uuid,
                        hole: newHole,
                        record: record,
                        shockWave: shockWave,
                        timer: null,
                      });
                      supportingCharacterLoadedCount++;
                      updateVoiceProgress();
                    } catch (error) {
                      devError('음성 로딩 실패:', originalSrc, error);
                      failedVoices.push(originalSrc);
                      updateVoiceProgress();
                    }
                  });
                }
              }
            }
          }
          await runWithConcurrency(loadTasks, VOICE_LOAD_CONCURRENCY);
        }
      } catch (e) {
        devError(e);
      } finally {
        debugVoiceLog('\n========== 보이스 로딩 완료 ==========');
        debugVoiceLog(`주조연 캐릭터 - 로드된 레코드: ${mainCharacterLoadedCount}개`);
        debugVoiceLog(`주조연 캐릭터 - 스킵된 레코드: ${mainCharacterSkippedCount}개`);
        debugVoiceLog(`단역 캐릭터 - 로드된 레코드: ${supportingCharacterLoadedCount}개`);
        debugVoiceLog(`최종 newVoiceShockWaves 총 개수: ${newVoiceShockWaves.length}개`);
        debugVoiceLog('========================================\n');

        playerLogger.log(`[setupVoice] 보이스 로딩 완료: ${newVoiceShockWaves.length}개 성공, ${failedVoices.length}개 실패`);
        if (failedVoices.length > 0) {
          playerLogger.warn(`[setupVoice] 실패한 보이스 목록:`, failedVoices);
          setFailedResources(prev => ({
            ...prev,
            voice: [...prev.voice, ...failedVoices]
          }));
        }
        setVoiceShockWaves(newVoiceShockWaves);
        setLoadingCount((prev) => prev - 1);
        verifyLoadingComplete();
      }
      return newVoiceShockWaves;
    },
    [
      voiceShockWaves,
      getMergeEffect,
      verifyLoadingComplete,
      playerStore,
      loadRecordings,
      site,
      recordingEpisodeId,
    ]
  );

  const getToonContentImageList = useCallback(() => {
    return DOMHelper.getToonContentImageList();
  }, []);

  const getTimeLineMs = useCallback((targetMarkers: any[] | null = null) => {
    const contentList = getToonContentImageList();
    if (!contentList) return 0;

    const scrollTop = contentList.scrollTop;
    const scrollHeight = contentList.scrollHeight;
    const scrollRange = Math.max(1, scrollHeight - contentList.clientHeight);
    const currentMarkers = targetMarkers || markers;

    if (version === 'V0') {
      return PositionCalculator.getTimeLineMsV0(scrollTop, scrollHeight, currentMarkers);
    } else {
      const viewOffsetTop = newViewOffsetTop();
      const imageScale = workspaceOptions.image_scale ?? 1;
      return PositionCalculator.getTimeLineMsV1(
        scrollTop,
        currentMarkers,
        viewOffsetTop,
        imageScale,
        calculatedWidth,  // 실제 계산된 화면 너비
        CARTOON_IMAGE_WIDTH_BASE,  // 기준 너비 (460px)
        scrollHeight,
        scrollRange
      );
    }
  }, [getToonContentImageList, markers, version, newViewOffsetTop, workspaceOptions, calculatedWidth]);

  const playVoiceAndEffects = useCallback(
    (timeStart = -1, targetShockWaves: any[] | null = null) => {
      const waves = targetShockWaves || voiceShockWaves;
      for (const shockWave of waves) {
        const holeStartMs = shockWave.hole?.start_ms ?? 0;
        const holeDurationMs =
          shockWave.hole?.duration_ms_force ?? shockWave.hole?.duration_ms ?? 0;

        if (timeStart > holeStartMs) {
          const calHoleDuration = holeDurationMs - (timeStart - holeStartMs);
          if (calHoleDuration <= 0) {
            continue;
          }
          shockWave.timer = setTimeout(() => {
            shockWave.shockWave.playSound((timeStart - holeStartMs) / 1000, calHoleDuration);
          }, 0);
          continue;
        }

        const delayMs = holeStartMs - timeStart;
        if (holeDurationMs <= 0) {
          continue;
        }
        shockWave.timer = setTimeout(() => {
          shockWave.shockWave.playSound(0, holeDurationMs);
        }, delayMs);
      }
    },
    [voiceShockWaves]
  );

  const playAudioAndEffects = useCallback(
    (timeStart = -1, targetShockWaves: any[] | null = null) => {
      const waves = targetShockWaves || audioShockWaves;
      for (const shockWave of waves) {
        const clipStartMs = shockWave.clip?.start_ms ?? 0;
        const trimLeftMs = shockWave.clip?.trim_left_ms ?? 0;
        const clipDurationMs = shockWave.clip?.effective_duration_ms ?? shockWave.clip?.duration_ms ?? 0;
        /** createShockWave.playSound은 Tone Player — position·duration 둘 다 초(s) */
        const trimLeftSec = trimLeftMs / 1000;
        const clipDurationSec = clipDurationMs / 1000;
        const clipVolume = typeof shockWave.clip?.volume === 'number' ? shockWave.clip.volume : 1;

        const clipGraph = shockWave.clip?.graph;
        const trackGraph = (shockWave as any)?.trackGraph;
        // 클립 graph X(퍼센트·로컬 ms)는 DubRight에서 "들리는 구간" 기준으로 잡는다.
        // duration_ms(타임라인 길이) + trim_right 등으로 effective가 더 짧을 때
        // duration_ms로 퍼센트를 풀면 엔벨로프가 재생 구간 밖으로 밀려 볼륨이 어긋난다.
        const graphPointsSec = buildCombinedTrackClipEnvelopeSec({
          trackGraph,
          clipGraph,
          clipStartMs,
          clipDurationMs,
          trimLeftMs,
        });
        if (graphPointsSec.length > 0 && typeof shockWave.shockWave?.setVolumeEnvelope === 'function') {
          shockWave.shockWave.setVolumeEnvelope(graphPointsSec, { baseGain: clipVolume });
        }

        if (timeStart > clipStartMs) {
          const calClipDurationMs = clipDurationMs - (timeStart - clipStartMs);
          if (calClipDurationMs < 0) continue;
          const timelineOffsetSec = (timeStart - clipStartMs) / 1000;
          shockWave.timer = setTimeout(() => {
            shockWave.shockWave.playSound(
              trimLeftSec + timelineOffsetSec,
              calClipDurationMs / 1000
            );
          }, 0);
          continue;
        }

        const delayMs = clipStartMs - timeStart;
        shockWave.timer = setTimeout(() => {
          shockWave.shockWave.playSound(trimLeftSec, clipDurationSec);
        }, delayMs);
      }
    },
    [audioShockWaves]
  );

  const setToonContentImageTop = useCallback(
    (position: number) => {
      // 모든 스크롤 레이어를 찾아서 동시에 스크롤 (일반 레이어 + ClearText 레이어)
      const scrollLayers = document.querySelectorAll('.toon-scroll-layer');
      if (scrollLayers.length === 0) {
        devLog('스크롤 컨테이너를 찾을 수 없어 스크롤 위치를 설정할 수 없습니다.');
        return;
      }

      // 모든 레이어의 scrollTop을 동일하게 설정
      scrollLayers.forEach((layer) => {
        if (layer instanceof HTMLElement) {
          const maxScrollTop = Math.max(0, layer.scrollHeight - layer.clientHeight);
          const nextScrollTop = Math.min(maxScrollTop, Math.max(0, position));
          layer.scrollTop = nextScrollTop;
        }
      });
    },
    []
  );

  const playSPointsAndEffects = useCallback(
    (timeMs: number, targetEffects: any[] | null = null, targetMarkers: any[] | null = null) => {
      shouldStopAllAnimationsRef.current = false;

      for (const timer of tmrSpointsRef.current) {
        if (typeof timer === 'object' && 'clear' in timer) {
          timer.clear();
        }
      }
      tmrSpointsRef.current = [];

      const currentEffects = targetEffects || effects;
      const currentMarkers = targetMarkers || markers;
      const sortedMarkers = [...currentMarkers].sort((a, b) => (a.time_ms ?? 0) - (b.time_ms ?? 0));

      const sortEffects = [...currentEffects]
        .filter((e) => {
          if (e.time_ms >= timeMs) return true;
          if (e.params?.sub_type === 'shake') {
            return (
              e.time_ms + ((e.params?.period ?? 0) * (e.params?.count ?? 0)) >= timeMs
            );
          } else if (e.params?.sub_type === 'fade') {
            return e.time_ms + (e.params?.duration ?? 0) >= timeMs;
          }
          return false;
        })
        .map((e) => {
          if (e.time_ms >= timeMs) return e;

          const calTimeMs = timeMs - e.time_ms;

          if (e.params?.sub_type === 'shake') {
            const calCount = Math.floor(
              calTimeMs / ((e.params?.period ?? 0) * (e.params?.count ?? 0))
            );
            if (calCount > 0) {
              return {
                ...e,
                time_ms: timeMs,
                params: {
                  ...e.params,
                  count: calCount,
                },
              };
            }
          } else if (e.params?.sub_type === 'fade') {
            return {
              ...e,
              time_ms: timeMs,
              params: {
                ...e.params,
                duration: (e.params.duration ?? 0) - calTimeMs,
              },
            };
          }
          return e;
        })
        .sort((a, b) => a.time_ms - b.time_ms);

      const timelineEvents = [
        ...sortedMarkers.map((point) => ({
          ...point,
          type: 'spoint',
        })),
        ...sortEffects.map((effect) => ({
          ...effect,
          type: 'effect',
        })),
      ].sort((a, b) => (a.time_ms ?? 0) - (b.time_ms ?? 0));

      const pos = getPositionAtTime(timeMs);
      setToonContentImageTop(pos);

      const maxEndTime =
        timelineEvents.length > 0
          ? (timelineEvents[timelineEvents.length - 1].time_ms ?? 0) + 500
          : timeMs + 500;

      const state = {
        lastTimestamp: null as number | null,
        virtualTime: timeMs,
        lastVirtualTime: timeMs,
        currentPosition: null as number | null,
        nextEventIndex: 0,
        animationId: null as number | null,
        lastTargetPosition: null as number | null,
      };

      function getPositionAtTime(virtualTimeMs: number): number {
        const contentList = getToonContentImageList();
        const currentScrollTop = contentList?.scrollTop ?? 0;

        if (version === 'V0') {
          const scrollHeight = contentList?.scrollHeight ?? 0;
          return PositionCalculator.getPositionAtTimeV0(
            virtualTimeMs,
            currentMarkers,
            scrollHeight,
            currentScrollTop
          );
        } else {
          const viewOffsetTop = newViewOffsetTop();
          const imageScale = workspaceOptions.image_scale ?? 1;
          const scrollHeight = contentList?.scrollHeight ?? 0;
          const scrollRange = contentList
            ? Math.max(1, scrollHeight - contentList.clientHeight)
            : 0;
          return PositionCalculator.getPositionAtTimeV1(
            virtualTimeMs,
            currentMarkers,
            imageScale,
            viewOffsetTop,
            currentScrollTop,
            calculatedWidth,  // 실제 계산된 화면 너비
            CARTOON_IMAGE_WIDTH_BASE,  // 기준 너비 (460px)
            scrollRange,
            scrollHeight
          );
        }
      }

      const animate = (timestamp: number) => {
        if (shouldStopAllAnimationsRef.current) {
          if (state.animationId !== null) {
            cancelAnimationFrame(state.animationId);
            state.animationId = null;
          }
          return;
        }

        if (state.lastTimestamp === null) {
          state.lastTimestamp = timestamp;
          state.animationId = requestAnimationFrame(animate);
          return;
        }

        const deltaTime = timestamp - state.lastTimestamp;
        state.lastTimestamp = timestamp;

        const adjustedDeltaTime = Math.min(deltaTime, 100);
        const virtualElapsed = adjustedDeltaTime * playSpeed;
        state.virtualTime += virtualElapsed;

        while (
          state.nextEventIndex < timelineEvents.length &&
          (timelineEvents[state.nextEventIndex].time_ms ?? 0) <= state.virtualTime &&
          !shouldStopAllAnimationsRef.current
          ) {
          const event = timelineEvents[state.nextEventIndex];

          if (event.type === 'effect') {
            if (toonWorkRef.current && typeof toonWorkRef.current.playEffect === 'function') {
              try {
                toonWorkRef.current.playEffect(event, false, 0, playSpeed);
              } catch (error) {
                devError('playEffect 호출 중 오류:', error);
              }
            }
          }

          state.nextEventIndex++;
        }

        if (shouldStopAllAnimationsRef.current) {
          return;
        }

        const targetPosition = getPositionAtTime(state.virtualTime);

        if (
          state.currentPosition === null ||
          Math.abs(targetPosition - state.currentPosition) > 0.5
        ) {
          setToonContentImageTop(targetPosition);
          state.currentPosition = targetPosition;
          state.lastTargetPosition = targetPosition;
        }

        state.lastVirtualTime = state.virtualTime;

        // 스크롤 위치 기반 완료 감지 (재생이 실제로 진행 중일 때만)
        const contentList = getToonContentImageList();
        const hasProgressed = state.virtualTime > timeMs + 500; // 재생 시작 후 500ms 이상 경과
        const isScrollAtBottom = contentList && hasProgressed
          ? Math.abs(contentList.scrollTop + contentList.clientHeight - contentList.scrollHeight) < 10
          : false;

        // 시간 기반 그리고 스크롤 위치 기반으로 완료 판단 (둘 다 충족해야 함)
        const isTimeComplete = state.virtualTime >= maxEndTime && state.nextEventIndex >= timelineEvents.length;
        const isComplete = isTimeComplete && isScrollAtBottom;

        if (
          !shouldStopAllAnimationsRef.current &&
          !isComplete
        ) {
          state.animationId = requestAnimationFrame(animate);
        } else {
          devLog('애니메이션 자연 종료', {
            isTimeComplete,
            isScrollAtBottom,
            virtualTime: state.virtualTime,
            maxEndTime
          });
          if (onComplete) {
            onComplete();
          }
          state.animationId = null;
        }
      };

      state.animationId = requestAnimationFrame(animate);

      const cleanupFunction = () => {
        shouldStopAllAnimationsRef.current = true;

        if (state.animationId !== null) {
          cancelAnimationFrame(state.animationId);
          state.animationId = null;
        }

        if (toonWorkRef.current && typeof toonWorkRef.current.stopAllEffects === 'function') {
          toonWorkRef.current.stopAllEffects();
        }
      };

      tmrSpointsRef.current.push({
        clear: cleanupFunction,
      });
    },
    [
      markers,
      effects,
      playSpeed,
      version,
      newViewOffsetTop,
      workspaceOptions,
      getToonContentImageList,
      setToonContentImageTop,
      calculatedWidth,  // 화면 크기 변경 시 재계산 필요
      onComplete,
    ]
  );

  const clearTmrSpoints = useCallback(() => {
    shouldStopAllAnimationsRef.current = true;
    TimerHelper.clearTimers(tmrSpointsRef.current);
    tmrSpointsRef.current = [];
  }, []);

  const stopSpointAndEffects = useCallback(() => {
    TimerHelper.clearMarkerEffectTimers(markers);
    TimerHelper.clearMarkerEffectTimers(effects);
    return true;
  }, [markers, effects]);

  const stopScrollBaseToonWork = useCallback(() => {
    PlayerControlHelper.stopScrollBaseToonWork();
  }, []);

  const stopAudio = useCallback(() => {
    TimerHelper.clearShockWaves(audioShockWaves);
    return true;
  }, [audioShockWaves]);

  const stopVoice = useCallback(() => {
    TimerHelper.clearShockWaves(voiceShockWaves);
    return true;
  }, [voiceShockWaves]);

  const stopPlaying = useCallback(() => {
    clearTmrSpoints();
    stopScrollBaseToonWork();
  }, [clearTmrSpoints, stopScrollBaseToonWork]);

  // AudioContext 상태를 'running'으로 만들고 확인하는 헬퍼 함수
  const waitForAudioContextRunning = useCallback(async (timeout = 3000): Promise<boolean> => {
    try {
      const Tone = await import('tone');
      const startTime = Date.now();

      playerLogger.log('[waitForAudioContextRunning] 시작, 현재 상태:', Tone.context.state);

      while (Date.now() - startTime < timeout) {
        const currentState = Tone.context.state as AudioContextState;

        if (currentState === 'running') {
          playerLogger.log('[waitForAudioContextRunning] 완료, 최종 상태: running, 성공: true');
          return true;
        }

        if (currentState === 'suspended') {
          playerLogger.log('[waitForAudioContextRunning] suspended 상태 감지, resume 시도');
          await Tone.context.resume();
          playerLogger.log('[waitForAudioContextRunning] resume 호출 완료, 상태:', Tone.context.state);
        } else if (currentState === 'closed') {
          playerLogger.error('[waitForAudioContextRunning] AudioContext가 closed 상태입니다.');
          return false;
        }

        // 100ms 대기 후 다시 확인
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalState = Tone.context.state as AudioContextState;
      const isRunning = finalState === 'running';
      playerLogger.log('[waitForAudioContextRunning] 완료, 최종 상태:', finalState, '성공:', isRunning);

      return isRunning;
    } catch (error) {
      playerLogger.error('[waitForAudioContextRunning] 오류:', error);
      return false;
    }
  }, []);

  // --- Public API ---
  const play = useCallback(async (startMsOverride?: number) => {
    // 초기화가 진행 중이면 재생 불가
    if (isInitializing) {
      devLog('초기화 진행 중 - 재생이 불가능합니다.');
      return;
    }

    // Safari 백그라운드 복귀 대응: AudioContext 및 전역 상태 확인
    try {
      const Tone = await import('tone');

      // AudioContext를 'running' 상태로 만들고 확인
      playerLogger.log('[useToonWork] AudioContext 상태 확인 시작:', Tone.context.state);
      const isAudioReady = await waitForAudioContextRunning();

      if (!isAudioReady) {
        playerLogger.error('[useToonWork] AudioContext를 running 상태로 만들지 못했습니다.');
        // 사용자에게 알림
        const { notify } = await import('@/lib/notify');
        notify.error('오디오 시스템을 시작할 수 없습니다. 페이지를 새로고침해주세요.');
        return;
      }

      playerLogger.log('[useToonWork] AudioContext running 확인 완료');

      // Destination 볼륨이 -Infinity인 경우 (백그라운드에서 자동 음소거된 경우) 복구
      if (Tone.Destination.volume.value === -Infinity && !isMutedRef.current) {
        playerLogger.log('[useToonWork] Destination 볼륨 비정상 감지 - 복구');
        Tone.Destination.volume.value = 0;
      }
    } catch (error) {
      playerLogger.error('[useToonWork] AudioContext 상태 확인/복구 실패:', error);
      const { notify } = await import('@/lib/notify');
      notify.error('오디오 시스템 오류가 발생했습니다.');
      return;
    }

    let currentAudioShockWaves = audioShockWaves;
    let currentVoiceShockWaves = voiceShockWaves;
    let currentEffects = effects;
    let currentMarkers = markers;

    // 리소스 부족 감지 및 재로딩 로직
    if (contentData) {
      let needReload = false;
      const reasons: string[] = [];

      if (contentData.audio_tracks?.length > 0 && audioShockWaves.length === 0) {
        needReload = true;
        reasons.push('audio');
      }
      if (contentData.tracks?.length > 0 && voiceShockWaves.length === 0) {
        needReload = true;
        reasons.push('voice');
      }
      if (contentData.effects?.length > 0 && effects.length === 0) {
        needReload = true;
        reasons.push('effects');
      }
      if (contentData.spoints?.length > 0 && markers.length === 0) {
        needReload = true;
        reasons.push('markers');
      }

      if (needReload) {
        playerLogger.log(`[useToonWork] play() - 리소스 부족 감지(${reasons.join(', ')}), 재로딩 시작`);
        try {
          const tasks: Promise<void>[] = [];

          if (reasons.includes('effects')) {
            tasks.push(setupEffects(contentData).then(res => { currentEffects = res; }));
          }
          if (reasons.includes('audio')) {
            tasks.push(setupAudio(contentData).then(res => { currentAudioShockWaves = res; }));
          }
          if (reasons.includes('voice')) {
            tasks.push(setupVoice(contentData).then(res => { currentVoiceShockWaves = res; }));
          }
          if (reasons.includes('markers')) {
            tasks.push(setupMarker(contentData).then(res => { currentMarkers = res; }));
          }

          await Promise.all(tasks);
          playerLogger.log('[useToonWork] play() - 리소스 재로딩 완료');
        } catch (e) {
          playerLogger.error('[useToonWork] play() - 리소스 재로딩 실패', e);
          return;
        }
      }
    }

    if (loadingCount > 0) {
      devLog('리소스 로딩 중 - 재생이 지연됩니다.');
      return;
    }

    if (!isStop) return;

    shouldStopAllAnimationsRef.current = true;

    if (toonWorkRef.current && typeof toonWorkRef.current.stopAllEffects === 'function') {
      toonWorkRef.current.stopAllEffects();
    }

    clearTmrSpoints();

    setIsStop(false);
    shouldStopAllAnimationsRef.current = false;

    // ref를 사용하여 항상 최신 mute 상태를 가져옴
    await AudioController.applyMuteState(isMutedRef.current);

    let rawTimeMs: number;
    let usedExplicitStartMs = false;
    if (typeof startMsOverride === "number" && Number.isFinite(startMsOverride)) {
      usedExplicitStartMs = true;
      rawTimeMs = Math.max(0, startMsOverride);
    } else {
      rawTimeMs = getTimeLineMs(currentMarkers);
    }
    /** 스크롤·마커 기준 재생: 타임라인을 약간 앞에서 시작해 대사 앞부분이 잘리지 않게 함 */
    const PLAYBACK_LEAD_MS = 220;
    const timeMs = usedExplicitStartMs
      ? rawTimeMs
      : Math.max(0, rawTimeMs - PLAYBACK_LEAD_MS);
    playVoiceAndEffects(timeMs, currentVoiceShockWaves);
    playAudioAndEffects(timeMs, currentAudioShockWaves);
    playSPointsAndEffects(timeMs, currentEffects, currentMarkers);
  }, [
    isInitializing,
    loadingCount,
    isStop,
    clearTmrSpoints,
    getTimeLineMs,
    playVoiceAndEffects,
    playAudioAndEffects,
    playSPointsAndEffects,
    contentData,
    audioShockWaves,
    voiceShockWaves,
    effects,
    markers,
    setupAudio,
    setupVoice,
    setupEffects,
    setupMarker,
    waitForAudioContextRunning
  ]);

  const stop = useCallback(async () => {
    if (isStop) return;

    playerLogger.log('[useToonWork] stop() 호출됨');

    shouldStopAllAnimationsRef.current = true;

    if (toonWorkRef.current && typeof toonWorkRef.current.stopAllEffects === 'function') {
      toonWorkRef.current.stopAllEffects();
    }

    stopPlaying();
    stopVoice();
    stopAudio();
    stopSpointAndEffects();

    // Tone.js 전역 정지 추가 (stop 시에도 확실히 정지)
    try {
      const Tone = await import('tone');
      playerLogger.log('[useToonWork] stop() - Tone.js 즉시 정지');
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
    } catch (error) {
      playerLogger.error('[useToonWork] stop() Tone.js 정지 중 오류:', error);
    }

    setIsStop(true);
    playerLogger.log('[useToonWork] stop() 완료');
  }, [isStop, stopPlaying, stopVoice, stopAudio, stopSpointAndEffects]);

  const getSpointMappingVoicetoon = useCallback(
    (spoint: number) => {
      return SpointMappingHelper.getSpointMappingVoicetoon(spointMappingData, spoint);
    },
    [spointMappingData]
  );

  const getSpointMappingWebtoon = useCallback(
    (spoint: number) => {
      return SpointMappingHelper.getSpointMappingWebtoon(spointMappingData, spoint);
    },
    [spointMappingData]
  );

  const initializeVoiceToon = useCallback(
    async (data: any | null, ticketCastings?: PurchaseCasting[]) => {
      try {
        playerLogger.log("[initializeVoiceToon] 초기화 시작");
        if (ticketCastings !== undefined) {
          playerLogger.log("[initializeVoiceToon] ticketCastings 적용", {
            count: ticketCastings.length,
            castings: ticketCastings.map(c => ({
              id: c.id,
              characterId: c.characterId,
              artistId: c.artistId,
              hasArtist: !!c.artist,
              artistDubrightId: c.artist?.dubrightId,
              hasCoupleArtists: !!c.coupleArtists,
              coupleArtistsCount: c.coupleArtists?.length ?? 0,
              coupleArtistsDubrightIds: c.coupleArtists?.map(a => a.dubrightId) ?? []
            }))
          });

          // 커플링 캐스팅을 포함한 모든 아티스트 ID 수집 (record.artist_no와 매칭하기 위해 artist.id 사용)
          overrideArtistNosRef.current = ticketCastings.flatMap(casting => {
            const artistIds: number[] = [];

            playerLogger.log(`[initializeVoiceToon] casting ${casting.id} 처리 중:`, {
              characterId: casting.characterId,
              artistId: casting.artistId,
              hasArtist: !!casting.artist,
              artistId_forMatching: casting.artist?.id,
              artistDubrightId: casting.artist?.dubrightId,
              hasCoupleArtists: !!casting.coupleArtists,
              coupleArtistsLength: casting.coupleArtists?.length
            });

            // 일반 아티스트 ID 추가 (record.artist_no와 매칭)
            // 수정: 오디오 파일(record)은 artist_no로 dubrightId를 사용하므로, 여기서도 dubrightId를 수집해야 함
            if (casting.artist?.dubrightId) {
              artistIds.push(casting.artist.dubrightId);
              playerLogger.log(`  → 일반 아티스트 추가: dubrightId=${casting.artist.dubrightId} (artist.id=${casting.artist.id})`);
            } else if (casting.artist?.id) {
               // dubrightId가 없는 경우에만 fallback으로 artist.id 사용 (혹시 모를 구형 데이터 대응)
              artistIds.push(casting.artist.id);
              playerLogger.log(`  → 일반 아티스트 추가 (Dubright ID 없음): artist.id=${casting.artist.id}`);
            }

            // 커플링 아티스트들의 ID 추가
            if (casting.coupleArtists && casting.coupleArtists.length > 0) {
              casting.coupleArtists.forEach((artist, idx) => {
                // 수정: 커플링 아티스트도 dubrightId를 우선 사용
                if (artist.dubrightId) {
                  artistIds.push(artist.dubrightId);
                  playerLogger.log(`  → 커플링 아티스트 ${idx + 1} 추가: dubrightId=${artist.dubrightId} (artist.id=${artist.id}, ${artist.nickname})`);
                } else if (artist.id) {
                   artistIds.push(artist.id);
                   playerLogger.log(`  → 커플링 아티스트 ${idx + 1} 추가 (Dubright ID 없음): artist.id=${artist.id} (${artist.nickname})`);
                }
              });
            }

            return artistIds;
          }).filter(id => id !== 0);

          overrideCharacterUUIDsRef.current = ticketCastings.filter(casting => (casting.character?.dubrightUUID ?? '') != '').map(casting => casting.character?.dubrightUUID ?? '');

          playerLogger.log("[initializeVoiceToon] 최종 수집된 아티스트 IDs (record.artist_no와 매칭용):", overrideArtistNosRef.current);
        } else {
          overrideArtistNosRef.current = null;
          overrideCharacterUUIDsRef.current = null;
        }

        // 초기화 전에 먼저 기존 리소스 정리 (중요!)
        playerLogger.log("[initializeVoiceToon] 기존 타이머 및 리소스 정리");
        shouldStopAllAnimationsRef.current = true;

        // 기존 타이머 정리
        clearTmrSpoints();
        TimerHelper.clearTimers(tmrSpointsRef.current);
        tmrSpointsRef.current = [];

        // 기존 ShockWave 정리
        if (voiceShockWaves.length > 0) {
          TimerHelper.destroyShockWaves(voiceShockWaves);
        }
        if (audioShockWaves.length > 0) {
          TimerHelper.destroyShockWaves(audioShockWaves);
        }

        setIsInitializing(true);
        updateProgress({ step: '초기화 준비 중...', percentage: 0 });
        // 실패한 리소스 목록 초기화
        setFailedResources({ audio: [], voice: [], image: [] });

        if (!data?.content) {
          playerLogger.error("플레이어 정보 조회 오류");
          setIsInitializing(false);
          return;
        }

        // V0 전용: AudioContext 초기화
        if (version === 'V0' && typeof window !== 'undefined' && !actxRef.current) {
          actxRef.current = new AudioContext();
        }

        updateProgress({ step: '화면 설정 중...', percentage: 5 });
        // setDisplayWidth()가 계산한 값을 즉시 사용 (setState 비동기 문제 해결)
        const newCalculatedWidth = setDisplayWidth();

        // V1: imageScale 고정, V0: 화면 비율 적용
        const newScale = version !== 'V0'
          ? imageWidthScaleBase
          : imageWidthScaleBase * (newCalculatedWidth / cartoonImageWidthBase);

        playerLogger.log(`[initializeVoiceToon] Version: ${version}, Width: ${newCalculatedWidth.toFixed(2)}, Scale: ${newScale.toFixed(4)}`);

        setImageWidthScale(newScale);
        setWorkspaceOptions({
          image_scale: newScale,
          work_type: 'player',
          calculatedWidth: newCalculatedWidth,
        });

        playerLogger.log('플레이 데이터');
        playerLogger.log(data);

        playerLogger.log('에피소드 정보');
        playerLogger.log(data.episode);
        setEpisode(data.episode);

        if (data.spointMappingData) {
          setSpointMappingData(data.spointMappingData);
        }

        playerLogger.log('컨텐츠 가공');
        const content = data.content;
        playerLogger.log(content);
        setContentData(content);

        // 이미지 준비: 0-25%
        updateProgress({ step: '이미지 준비 중...', percentage: 0 });
        playerLogger.log('이미지 가공');
        playerLogger.log(content.images);
        const imageList = content.images ?? [];

        const directions = data.directions ?? [];
        let clearTextImages = [];
        for (const direction of directions) {
          if (direction.version === 'V2') {
            clearTextImages = JSON.parse(direction.images ?? '[]');
          }
        }

        setImages(imageList);
        setClearTextImages(clearTextImages);

        // 이미지는 Next.js Image 컴포넌트의 onLoad로 추적
        playerLogger.log(`[initializeVoiceToon] 이미지 ${imageList.length + clearTextImages.length}개 준비`);
        updateProgress({ step: '이미지 준비 완료', percentage: 5 });

        // 마커/이펙트 설정
        await setupMarker(content);
        await setupEffects(content);

        // 보이스 로딩: 10-90%
        updateProgress({step: '보이스 로딩 중...', percentage: 10});
        await setupVoice(content, 1.0, (loaded, total) => {
          const voiceProgress = total > 0 ? (loaded / total) * 80 : 0;
          updateProgress({step: `보이스 로딩 중... (${loaded}/${total})`, percentage: 10 + voiceProgress});
        });

        // 사운드(오디오) 로딩: 90-95%
        updateProgress({step: '사운드 로딩 중...', percentage: 90});
        await setupAudio(content, (loaded, total) => {
          const audioProgress = total > 0 ? (loaded / total) * 5 : 0;
          updateProgress({step: `사운드 로딩 중... `, percentage: 90 + audioProgress});
        });

        // 최종 설정: 95-100%
        updateProgress({step: '최종 설정 중...', percentage: 95});
        window.addEventListener('resize', handleResize);
        // 모바일 화면 회전 대응
        window.addEventListener('orientationchange', handleResize);
        setToonContentImageTop(0);

        playerLogger.log('[initializeVoiceToon] 초기화 완료');

        // 실패한 리소스 요약 출력
        const totalFailed = failedResources.audio.length + failedResources.voice.length;
        if (totalFailed > 0) {
          playerLogger.warn(`[initializeVoiceToon] 총 ${totalFailed}개의 리소스 로딩 실패`);
          if (failedResources.audio.length > 0) {
            playerLogger.warn(`  - 실패한 오디오: ${failedResources.audio.length}개`);
          }
          if (failedResources.voice.length > 0) {
            playerLogger.warn(`  - 실패한 보이스: ${failedResources.voice.length}개`);
          }
        } else {
          playerLogger.log('[initializeVoiceToon] 모든 리소스 로딩 성공');
        }

        setIsInitializing(false);
        updateProgress({ step: '완료', percentage: 100 });
      } catch (error) {
        playerLogger.error('[initializeVoiceToon] 초기화 중 오류:', error);
        setIsInitializing(false);
        updateProgress({ step: '오류 발생', percentage: 0 });
      }
    },
    [
      version,
      setDisplayWidth,
      imageWidthScaleBase,
      cartoonImageWidthBase,
      setupMarker,
      setupEffects,
      setupAudio,
      setupVoice,
      handleResize,
      setToonContentImageTop,
      updateProgress,
      audioShockWaves,
      clearTmrSpoints,
      failedResources.audio.length,
      failedResources.voice.length,
      voiceShockWaves,
    ]
  );

  const changeVoice = useCallback(async () => {
    await setupVoice(contentData);
  }, [contentData, setupVoice]);

  // 캐스팅 변경 시 보이스만 재로드 (ticketCastings 기반)
  const reloadVoice = useCallback(async (ticketCastings: PurchaseCasting[]) => {
    playerLogger.log('[reloadVoice] 보이스 재로드 시작', {
      castingsCount: ticketCastings.length,
    });

    if (!contentData || !contentData.tracks) {
      playerLogger.error('[reloadVoice] contentData 없음');
      return;
    }

    try {
      // 1. 기존 보이스 ShockWave 정리 (현재 상태 캡처)
      const currentVoiceShockWaves = voiceShockWaves;
      if (currentVoiceShockWaves.length > 0) {
        playerLogger.log('[reloadVoice] 기존 보이스 정리:', currentVoiceShockWaves.length);

        // 각 ShockWave의 타이머 및 사운드 정리
        for (const sw of currentVoiceShockWaves) {
          if (sw.timer) {
            clearTimeout(sw.timer);
            sw.timer = null;
          }
          if (sw.shockWave) {
            try {
              sw.shockWave.stopSound();
              if (typeof sw.shockWave.destroy === 'function') {
                sw.shockWave.destroy();
              }
            } catch (e) {
              playerLogger.warn('[reloadVoice] ShockWave 정리 중 오류 (무시됨):', e);
            }
          }
        }
      }

      // 상태를 빈 배열로 설정 (setupVoice에서 중복 정리 방지)
      setVoiceShockWaves([]);

      // 2. overrideArtistNosRef 및 overrideCharacterUUIDsRef 업데이트 (initializeVoiceToon과 동일한 로직)
      if (ticketCastings.length > 0) {
        overrideArtistNosRef.current = ticketCastings.flatMap(casting => {
          const artistIds: number[] = [];

          if (casting.artist?.dubrightId) {
            artistIds.push(casting.artist.dubrightId);
          } else if (casting.artist?.id) {
            artistIds.push(casting.artist.id);
          }

          if (casting.coupleArtists && casting.coupleArtists.length > 0) {
            casting.coupleArtists.forEach(artist => {
              if (artist.dubrightId) {
                artistIds.push(artist.dubrightId);
              } else if (artist.id) {
                artistIds.push(artist.id);
              }
            });
          }

          return artistIds;
        }).filter(id => id !== 0);

        overrideCharacterUUIDsRef.current = ticketCastings
          .filter(casting => (casting.character?.dubrightUUID ?? '') !== '')
          .map(casting => casting.character?.dubrightUUID ?? '');

        playerLogger.log('[reloadVoice] 아티스트/캐릭터 UUID 업데이트:', {
          artistNos: overrideArtistNosRef.current,
          characterUUIDs: overrideCharacterUUIDsRef.current,
        });
      }

      // 3. 상태 업데이트가 반영될 때까지 잠시 대기 (React 배칭 고려)
      await new Promise(resolve => setTimeout(resolve, 50));

      // 4. 보이스 재로드 (setupVoice의 skipCleanup 플래그 없이 호출)
      // setupVoice 내부에서 voiceShockWaves.length가 0이므로 중복 정리 없음
      await setupVoice(contentData);

      playerLogger.log('[reloadVoice] 보이스 재로드 완료');
    } catch (error) {
      playerLogger.error('[reloadVoice] 오류:', error);
    }
  }, [contentData, setupVoice, voiceShockWaves]);

  const cleanup = useCallback(async () => {
    playerLogger.log('[useToonWork] cleanup() 시작 - 모든 리소스 정리');

    // 1. 애니메이션 중단
    shouldStopAllAnimationsRef.current = true;

    // 2. 이펙트 정지
    if (toonWorkRef.current && typeof toonWorkRef.current.stopAllEffects === 'function') {
      try {
        toonWorkRef.current.stopAllEffects();
      } catch (e) {
        devError('[useToonWork] stopAllEffects 중 오류:', e);
      }
    }

    // 3. 모든 타이머 정리
    clearTmrSpoints();
    TimerHelper.clearTimers(tmrSpointsRef.current);
    tmrSpointsRef.current = [];

    // 4. 마커 및 이펙트 타이머 정리
    TimerHelper.clearMarkerEffectTimers(markers);
    TimerHelper.clearMarkerEffectTimers(effects);

    // 5. 모든 ShockWave 완전 정리 (Player까지 제거)
    playerLogger.log('[useToonWork] ShockWave 정리 시작 - voice:', voiceShockWaves.length, 'audio:', audioShockWaves.length);
    TimerHelper.destroyShockWaves(voiceShockWaves);
    TimerHelper.destroyShockWaves(audioShockWaves);
    playerLogger.log('[useToonWork] ShockWave 정리 완료');

    // 6. Tone.js 전역 정지 (추가 안전장치)
    try {
      const Tone = await import('tone');
      playerLogger.log('[useToonWork] Tone.js Transport 및 전체 사운드 중지');
      Tone.getTransport().stop();
      Tone.getTransport().cancel();

      // 모든 활성 소스 중지
      Tone.getDestination().volume.value = -Infinity;

      // 재생 중인 모든 Tone.Player 강제 중지
      if (Tone.Transport.state === 'started') {
        Tone.Transport.pause();
      }
    } catch (error) {
      playerLogger.error('[useToonWork] Tone.js 정지 중 오류:', error);
    }

    // 7. resize 및 orientationchange 이벤트 리스너 제거
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleResize);

    // 8. V0 전용: AudioContext 정리
    if (version === 'V0') {
      if (actxRef.current) {
        actxRef.current.close().catch((e: any) => {
          devError('[useToonWork] AudioContext close 중 오류:', e);
        });
        actxRef.current = null;
      }

      if (frameTimerRef.current) {
        clearTimeout(frameTimerRef.current);
        frameTimerRef.current = null;
      }
      if (loadScriptTimerRef.current) {
        clearTimeout(loadScriptTimerRef.current);
        loadScriptTimerRef.current = null;
      }

      // V0 전용 데이터 초기화
      decodedAudioDataPoolRef.current = {};
      dubbingPoolRef.current = {};
      bufferSourcePoolRef.current = {};
      soundEffectsInfoRef.current = [];
      producedContentInfoRef.current = {};
      approvedParticipantInfoRef.current = [];
      markerListRef.current = [];
      scriptListRef.current = [];
    }

    // 9. 상태 초기화
    setVoiceShockWaves([]);
    setAudioShockWaves([]);
    setMarkers([]);
    setEffects([]);
    setImages([]);
    setClearTextImages([]);
    setIsStop(true);
    setIsInitializing(false);
    updateProgress({ step: '', percentage: 0 });
    setFailedResources({ audio: [], voice: [], image: [] });

    playerLogger.log('[useToonWork] cleanup() 완료');
  }, [
    version,
    handleResize,
    voiceShockWaves,
    audioShockWaves,
    markers,
    effects,
    clearTmrSpoints,
    updateProgress,
  ]);

  const getCurrentImages = useCallback(() => {
    if (version === 'V0') {
      return images.map((img: any) => ({
        url: img.url || img.rawSrc || img.src,
        id: img.uuid || img.order,
        order: img.order,
        ...img
      }));
    }
    return images;
  }, [version, images]);

  const toggleMute = useCallback(async (muted: boolean) => {
    playerLogger.log(`toggleMute 호출됨: ${muted ? 'MUTED' : 'UNMUTED'}`);
    setIsMuted(muted);
    isMutedRef.current = muted;
    // 즉시 Tone.js 전역 볼륨 적용 (재생 중이어도 즉시 반영됨)
    await AudioController.setGlobalMute(muted);
  }, []);

  const setSelectArtistNos = useCallback((nos: number[]) => {
    overrideArtistNosRef.current = nos;
  }, []);

  const getAllHoles = useCallback(() => {
    const content: any = contentData ?? {};
    const newHoles: any[] = [];
    if (content.tracks) {
      for (const track of content.tracks) {
        const character_uuid = track.character_uuid ?? undefined;
        const character_name = track.character_name ?? '';
        const holesArr = track.holes ?? [];
        for (const hole of holesArr) {
          newHoles.push({ ...hole, character_uuid, characterName: character_name });
        }
      }
    }
    newHoles.sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0));
    return newHoles;
  }, [contentData]);

  /** 재생 타임라인과 동일한 정규화 마커 (장면 이동·시크 등에서 store spoints 대신 사용) */
  const getMarkers = useCallback(() => markers, [markers]);

  // --- Return Public API ---
  return {
    // Refs
    toonBoxRef,
    toonWorkRef,

    // Loading state
    loadingCount,
    isInitializing,
    initializationProgress,
    failedResources,
    // V0 전용 refs (V0에서만 사용하지만 API 일관성을 위해 항상 반환)
    ...(version === 'V0' ? {
      scrollTargetRef,
      imgsRef,
      actxRef,
      decodedAudioDataPoolRef,
      dubbingPoolRef,
      bufferSourcePoolRef,
      frameTimerRef,
      loadScriptTimerRef,
      tsStartAtRef,
      lastTSDiffRef,
      currentMarkerIdxRef,
      lastFiredScriptIdxRef,
      lastLoadedScriptIndexRef,
      lastProgressMessageRef,
      soundEffectsInfoRef,
      producedContentInfoRef,
      approvedParticipantInfoRef,
      markerListRef,
      scriptListRef,
    } : {}),

    // State
    episode,
    contentData,
    images,
    clearTextImages,
    calculatedWidth,
    calculatedWidthCustom,
    isStop,
    isMuted,
    workspaceOptions,

    // Methods
    play,
    stop,
    initializeVoiceToon,
    cleanup,
    getCurrentImages,
    getToonContentImageList,
    getTimeLineMs,
    setToonContentImageTop,
    getSpointMappingVoicetoon,
    getSpointMappingWebtoon,
    newViewOffsetTop,
    changeVoice,
    reloadVoice,
    toggleMute,
    setSelectArtistNos,
    handleResize,
    getAllHoles,
    getMarkers,
  };
}
