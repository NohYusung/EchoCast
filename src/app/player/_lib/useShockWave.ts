/* eslint-disable @typescript-eslint/no-explicit-any */
/*
    useShockWave.ts
    Audio processing hook for React + Next.js
    Author : Kendrick Kim(kjkim@mobipintech.com)
    Refactored for React by AI Assistant
    Last update : 2025-10-27
*/

import { useState, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import {Chorus, FeedbackDelay, Reverb, ToneAudioNode} from "tone";
import {PLAYER_DEFAULT_EFFECT} from "@/models/playerData";

type DisposableNode = Chorus | Reverb | FeedbackDelay | ToneAudioNode;

interface DrawOptions {
  channelNum?: number;
  millisecondPerPixel?: number;
  height?: number;
  style?: 'wave' | 'bar';
  backgroundColor?: string;
  signalColor?: string;
}
/**
 * @deprecated React 훅 규칙 위반으로 인해 더 이상 사용되지 않습니다. 대신 createShockWave 팩토리 함수를 사용하세요.
 * 이 훅은 단일 컴포넌트에서 하나의 오디오 인스턴스만 필요할 때 참고용으로 남겨둘 수 있습니다.
 * 하지만 여러 인스턴스를 동적으로 생성해야 하는 useToonWork에서는 사용할 수 없습니다.
 */
export function useShockWave() {
  // --- State ---
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1.0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [currentStatus, setCurrentStatus] = useState<'stop' | 'play' | 'loading'>('stop');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [effects, setEffects] = useState<any>(JSON.parse(JSON.stringify(PLAYER_DEFAULT_EFFECT)));

  // --- Refs for non-reactive data ---
  const tonePlayerRef = useRef<Tone.Player | null>(null);
  const sampleBufferRef = useRef<Float32Array[]>([]);
  const needToDisposeRef = useRef<DisposableNode[]>([]);
  const tmrPlayingRef = useRef<NodeJS.Timeout | null>(null);
  const timeStampStartRef = useRef(0);

  // --- Private Methods ---

  const disposeEffects = useCallback(() => {
    for (const effect of needToDisposeRef.current) {
      try {
        if (!effect.disposed) {
          effect.dispose();
        }
      } catch (e) {
        console.error('[useShockWave] Failed to dispose effect node:', e);
      }
    }
    needToDisposeRef.current = [];
  }, []);

  const disposePlayer = useCallback(() => {
    if (tonePlayerRef.current) {
      try {
        if (!tonePlayerRef.current.disposed) {
          tonePlayerRef.current.disconnect();
          tonePlayerRef.current.stop();
          tonePlayerRef.current.dispose();
        }
      } catch (e) {
        console.error('[useShockWave] Failed to dispose player:', e);
      }
      tonePlayerRef.current = null;
    }
  }, []);

  const buildChorusEffect = useCallback(() => {
    if (
      effects?.chorus &&
      (effects?.chorus?.frequency !== 0 ||
        effects?.chorus?.depth !== 0 ||
        effects?.chorus?.delayTime !== 0)
    ) {
      const chorus = new Tone.Chorus(
        effects.chorus.frequency,
        effects.chorus.delayTime,
        effects.chorus.depth
      );
      needToDisposeRef.current.push(chorus);
      return chorus;
    }
    return null;
  }, [effects]);

  const buildPitchShiftEffect = useCallback(() => {
    if (effects?.pitch_shift !== undefined && effects?.pitch_shift !== 0) {
      const pitchShift = new Tone.PitchShift(effects?.pitch_shift);
      needToDisposeRef.current.push(pitchShift);
      return pitchShift;
    }
    return null;
  }, [effects]);

  const buildReverbEffect = useCallback(() => {
    if (effects?.reverb && effects?.reverb?.decay > 0 && effects?.reverb?.preDelay > 0) {
      const reverb = new Tone.Reverb({ ...effects.reverb });
      needToDisposeRef.current.push(reverb);
      return reverb;
    }
    return null;
  }, [effects]);

  const buildFeedbackDelayEffect = useCallback(() => {
    if (effects?.delay && effects?.delay?.delay > 0 && effects?.delay?.feedback > 0) {
      const delay = new Tone.FeedbackDelay({
        delayTime: effects.delay.delay,
        feedback: effects.delay.feedback,
      });
      needToDisposeRef.current.push(delay);
      return delay;
    }
    return null;
  }, [effects]);

  const buildEqEffect = useCallback(
    (input: Tone.ToneAudioNode) => {
      if (!effects?.eq) return null;

      const gainValues = effects.eq.gain_values;
      // TODO: 추후 확인
      // if (!gainValues.some((value) => value !== 1)) return null;

      const eqGains = gainValues.map((value: number) => {
        const gain = new Tone.Gain(value);
        needToDisposeRef.current.push(gain);
        return gain;
      });
      // TODO: gainValues가 모두 1일 경우, EQ 이펙트를 적용하지 않도록 최적화 필요

      const outputMultibandMain = new Tone.Gain();
      needToDisposeRef.current.push(outputMultibandMain);

      const multibandMain = new Tone.MultibandSplit(250, 2000);
      needToDisposeRef.current.push(multibandMain);

      const multibandSub1 = new Tone.MultibandSplit(50, 120);
      needToDisposeRef.current.push(multibandSub1);
      multibandSub1.low.chain(eqGains[0], outputMultibandMain);
      multibandSub1.mid.chain(eqGains[1], outputMultibandMain);
      multibandSub1.high.chain(eqGains[2], outputMultibandMain);
      multibandMain.low.connect(multibandSub1);

      const multibandSub2 = new Tone.MultibandSplit(500, 1000);
      needToDisposeRef.current.push(multibandSub2);
      multibandSub2.low.chain(eqGains[3], outputMultibandMain);
      multibandSub2.mid.chain(eqGains[4], outputMultibandMain);
      multibandSub2.high.chain(eqGains[5], outputMultibandMain);
      multibandMain.mid.connect(multibandSub2);

      const multibandSub3 = new Tone.MultibandSplit(6000, 8000);
      needToDisposeRef.current.push(multibandSub3);
      multibandSub3.low.chain(eqGains[6], outputMultibandMain);
      multibandSub3.mid.chain(eqGains[7], outputMultibandMain);
      multibandSub3.high.chain(eqGains[8], outputMultibandMain);
      multibandMain.high.connect(multibandSub3);

      input.connect(multibandMain);
      return outputMultibandMain;
    },
    [effects]
  );

  // --- Public API ---
  const draw = useCallback(
    (
      canvasRef: HTMLCanvasElement | null,
      options: DrawOptions = {}
    ) => {
      const {
        channelNum = 0,
        millisecondPerPixel = 50,
        height = 100,
        style = 'wave',
        backgroundColor = '#FF4848',
        signalColor = '#fff500',
      } = options;

      if (!canvasRef) return;

      const pixelPerMillisecond = (1 / millisecondPerPixel) * (1 / playbackRate);
      const durationMs = duration * 1000;
      const width = Math.floor(durationMs * pixelPerMillisecond);

      canvasRef.width = width;
      canvasRef.height = height;

      const ctx = canvasRef.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      const buffer = sampleBufferRef.current[Math.min(channelNum, sampleBufferRef.current.length - 1)];
      if (!buffer) return;

      const samplesForDraw: [number, number][] = [];
      let sampleMaxValue = 0.1;
      const step = buffer.length / width;

      for (let i = 0; i < width; i++) {
        const start = Math.floor(i * step);
        const end = Math.floor((i + 1) * step);
        let currentPositive = 0;
        let currentNegative = 0;
        for (let j = start; j < end; j++) {
          const val = buffer[j] || 0;
          if (val > 0) currentPositive += val;
          else currentNegative += val;
        }
        const avgPositive = currentPositive / (end - start);
        const avgNegative = currentNegative / (end - start);

        if (sampleMaxValue < Math.abs(avgPositive)) sampleMaxValue = Math.abs(avgPositive);
        if (sampleMaxValue < Math.abs(avgNegative)) sampleMaxValue = Math.abs(avgNegative);

        samplesForDraw.push([avgPositive, avgNegative]);
      }

      ctx.fillStyle = signalColor;
      ctx.strokeStyle = signalColor;

      if (style === 'wave') {
        for (let i = 0; i < samplesForDraw.length; i++) {
          const [valuePositive, valueNegative] = samplesForDraw[i];
          let heightPositive = (valuePositive / sampleMaxValue) * height * 0.4;
          let heightNegative = (valueNegative / sampleMaxValue) * height * 0.4;
          if (Math.abs(heightPositive) < 1 && Math.abs(heightNegative) < 1) {
            heightPositive = 1;
            heightNegative = 0;
          }
          ctx.fillRect(i, height / 2 - heightPositive, 1, heightPositive - heightNegative);
        }
      } else if (style === 'bar') {
        // Bar drawing logic can be implemented here if needed
      }
    },
    [duration, playbackRate]
  );

  const playSound = useCallback(
    async (position = 0, playDuration = -1) => {
      if (!tonePlayerRef.current || currentStatus === 'play') return;

      // 재생 전, 이전 이펙트 체인을 정리합니다.
      disposeEffects();

      tonePlayerRef.current.playbackRate = playbackRate;

      const input = new Tone.Gain(1.0);
      needToDisposeRef.current.push(input);
      tonePlayerRef.current.connect(input);

      // --- 이펙트 체인을 명확하게 직렬로 구성합니다 ---
      let lastNode: Tone.ToneAudioNode = input;

      // EQ 이펙트
      const eqEffect = buildEqEffect(lastNode);
      if (eqEffect) {
        lastNode = eqEffect;
      }

      // Chorus, Reverb, Delay, PitchShift 이펙트를 순서대로 연결합니다.
      [
        buildChorusEffect,
        buildReverbEffect,
        buildFeedbackDelayEffect,
        buildPitchShiftEffect,
      ].forEach((buildEffect) => {
        const effectNode = buildEffect();
        if (effectNode) {
          lastNode.connect(effectNode);
          lastNode = effectNode;
        }
      });

      // 최종 Gain (볼륨) 이펙트
      if (effects?.gain?.value !== 1) {
        const gainNode = new Tone.Gain(effects.gain.value);
        needToDisposeRef.current.push(gainNode);
        lastNode.connect(gainNode);
        lastNode = gainNode;
      }

      // 체인의 가장 마지막 노드를 오디오 출력(스피커)에 연결합니다.
      lastNode.toDestination();

      setCurrentStatus('play');
      timeStampStartRef.current = new Date().getTime() - position * 1000;

      const effectiveDuration = playDuration === -1 ? duration - position : playDuration;
      if (position < 0 || effectiveDuration < 0) return;

      tonePlayerRef.current.start(0, position, effectiveDuration);

      const onStop = () => {
        setCurrentStatus('stop');
        disposeEffects();
      };

      if (tmrPlayingRef.current) clearTimeout(tmrPlayingRef.current);
      tmrPlayingRef.current = setTimeout(onStop, (effectiveDuration * 1000) / playbackRate);
      tonePlayerRef.current.onstop = onStop;
    },
    [
      currentStatus,
      playbackRate,
      duration,
      effects,
      disposeEffects,
      buildEqEffect,
      buildChorusEffect,
      buildReverbEffect,
      buildFeedbackDelayEffect,
      buildPitchShiftEffect,
    ]
  );

  const stopSound = useCallback(() => {
    if (tmrPlayingRef.current) clearTimeout(tmrPlayingRef.current);
    if (tonePlayerRef.current) {
      tonePlayerRef.current.stop();
    }
    if (currentStatus === 'play') {
      setCurrentStatus('stop');
      disposeEffects();
    }
  }, [currentStatus, disposeEffects]);

  const getCurrentTimeMillis = useCallback(() => {
    if (currentStatus === 'play') {
      return new Date().getTime() - timeStampStartRef.current;
    }
    return 0;
  }, [currentStatus]);

  const destroy = useCallback(() => {
    stopSound();
    disposeEffects();
    disposePlayer();
  }, [disposeEffects, disposePlayer, stopSound]);

  const load = useCallback(
    async (
      newUrl: string,
      initialEffects: any,
      autoPlay = false,
      newPlaybackRate = 1.0
    ) => {
      setIsLoading(true);
      setCurrentStatus('loading');
      setUrl(newUrl);
      setPlaybackRate(newPlaybackRate);

      // 이전 플레이어와 이펙트를 모두 정리합니다.
      stopSound();
      disposeEffects();
      disposePlayer();

      try {
        // --- 디버깅을 위한 사전 요청 ---
        const debugResponse = await fetch(newUrl);
        if (!debugResponse.ok || !debugResponse.headers.get('content-type')?.startsWith('audio')) {
          console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
          console.error(debugResponse.url);
          console.error('!!! S3 응답 오류: 오디오 파일이 아닌 데이터 수신 !!!');
          console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
          console.error('- HTTP 상태:', `${debugResponse.status} ${debugResponse.statusText}`);
          console.error('- Content-Type:', debugResponse.headers.get('content-type'));
          try {
            const errorText = await debugResponse.text();
            console.error('- 응답 내용 (아래 XML/HTML 에러를 확인하세요):');
            console.error(errorText);
          } catch {
            console.error('- 응답 내용을 텍스트로 읽는 데 실패했습니다.');
          }
          throw new Error(
            'S3 did not return a valid audio file. Check console for the actual response from S3.'
          );
        }

        // Tone.js 플레이어가 오디오 로딩 및 디코딩을 모두 처리하도록 합니다.
        tonePlayerRef.current = new Tone.Player();

        await tonePlayerRef.current.load(newUrl);

        // 로딩 성공 후, 플레이어의 버퍼에서 오디오 정보를 가져옵니다.
        const audioBuffer = tonePlayerRef.current.buffer.get();
        if (!audioBuffer) throw new Error('Tone.Player loaded, but the audio buffer is empty.');

        setDuration(audioBuffer.duration);
        sampleBufferRef.current = [];
        for (let channelNum = 0; channelNum < Math.min(2, audioBuffer.numberOfChannels); channelNum++) {
          sampleBufferRef.current[channelNum] = audioBuffer.getChannelData(channelNum);
        }

        setEffects(initialEffects || JSON.parse(JSON.stringify(PLAYER_DEFAULT_EFFECT)));

        if (autoPlay) {
          await playSound();
        }

        setCurrentStatus('stop');
        return true;
      } catch (e) {
        console.error(`[useShockWave] 오디오 로딩 또는 디코딩 중 오류 발생 (URL: ${newUrl})`, e);
        disposePlayer();
        return false;
      } finally {
        setIsLoading(false);
        if (currentStatus === 'loading') {
          setCurrentStatus('stop');
        }
      }
    },
    [currentStatus, disposeEffects, disposePlayer, playSound, stopSound]
  );

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    if (tonePlayerRef.current && !tonePlayerRef.current.disposed) {
      tonePlayerRef.current.volume.value = Tone.dbToGain(newVolume);
    }
  }, []);

  const setEffect = useCallback(
    async (newEffects: Partial<any>) => {
      const wasPlaying = currentStatus === 'play';
      const position = getCurrentTimeMillis() / 1000;

      if (wasPlaying) {
        stopSound();
      }

      setEffects((prev: any) => ({ ...prev, ...newEffects }));

      if (wasPlaying) {
        await playSound(position);
      }
    },
    [currentStatus, getCurrentTimeMillis, playSound, stopSound]
  );

  // --- Return Public API ---
  return {
    // State
    duration,
    volume,
    playbackRate,
    currentStatus,
    isLoading,
    currentTime,
    effects,
    url,

    // Methods
    load,
    draw,
    playSound,
    stopSound,
    setVolume,
    setEffect,
    destroy,
    getCurrentTimeMillis,
  };
}

export type ShockWaveInstance = ReturnType<typeof createShockWave>;

/**
 * ShockWave 인스턴스를 생성하는 팩토리 함수입니다.
 * React 훅에 의존하지 않으므로, 필요에 따라 여러 인스턴스를 동적으로 생성할 수 있습니다.
 */
export function createShockWave() {
  // --- 내부 상태 및 참조 (클로저를 통해 관리) ---
  let tonePlayer: Tone.Player | null = null;
  let sampleBuffer: Float32Array[] = [];
  let needToDispose: DisposableNode[] = [];
  let tmrPlaying: NodeJS.Timeout | null = null;
  let currentPlaybackRate = 1.0;
  let currentEffects: any = JSON.parse(JSON.stringify(PLAYER_DEFAULT_EFFECT));
  let currentStatus: 'stop' | 'play' | 'loading' = 'stop';
  /**
   * audio_tracks의 graph(볼륨 자동화)을 playSound 직전에 적용하기 위한 임시 저장소.
   * - points: [tSecInBuffer, linearGain] (buffer 기준, DubRight 스타일로 1 초과 가능)
   * - baseGain: clip.volume 등 외부 스케일 (기본 1)
   */
  let pendingVolumeEnvelope:
    | { points: Array<[number, number]>; baseGain?: number }
    | null = null;

  /** 트랙×클립 등 곱해진 뒤 스케줄용 상한 (200%×200%×볼륨 여유) */
  const ENVELOPE_LINEAR_GAIN_CAP = 8;

  // --- 내부 헬퍼 함수 ---
  const disposeEffects = () => {
    for (const effect of needToDispose) {
      try {
        if (!effect.disposed) effect.dispose();
      } catch (e) {
        console.error('[createShockWave] Failed to dispose effect node:', e);
      }
    }
    needToDispose = [];
  };

  const disposePlayer = () => {
    if (tonePlayer) {
      try {
        if (!tonePlayer.disposed) {
          tonePlayer.disconnect();
          tonePlayer.stop();
          tonePlayer.dispose();
        }
      } catch (e) {
        console.error('[createShockWave] Failed to dispose player:', e);
      }
      tonePlayer = null;
    }
  };

  const stopSound = () => {
    if (tmrPlaying) clearTimeout(tmrPlaying);
    if (tonePlayer) {
      tonePlayer.stop();
    }
    if (currentStatus === 'play') {
      currentStatus = 'stop';
      disposeEffects();
    }
  };

  // --- 이펙트 빌더 ---
  const buildChorusEffect = () => {
    const { chorus } = currentEffects;
    if (chorus && (chorus.frequency !== 0 || chorus.depth !== 0 || chorus.delayTime !== 0)) {
      const effect = new Tone.Chorus(chorus.frequency, chorus.delayTime, chorus.depth);
      needToDispose.push(effect);
      return effect;
    }
    return null;
  };

  const buildPitchShiftEffect = () => {
    const { pitch_shift } = currentEffects;
    if (pitch_shift !== undefined && pitch_shift !== 0) {
      const effect = new Tone.PitchShift(pitch_shift);
      needToDispose.push(effect);
      return effect;
    }
    return null;
  };

  const buildReverbEffect = () => {
    const { reverb } = currentEffects;
    if (reverb && reverb.decay > 0 && reverb.preDelay > 0) {
      const effect = new Tone.Reverb({ ...reverb });
      needToDispose.push(effect);
      return effect;
    }
    return null;
  };

  const buildFeedbackDelayEffect = () => {
    const { delay } = currentEffects;
    if (delay && delay.delay > 0 && delay.feedback > 0) {
      const effect = new Tone.FeedbackDelay({ delayTime: delay.delay, feedback: delay.feedback });
      needToDispose.push(effect);
      return effect;
    }
    return null;
  };

  const buildEqEffect = (input: Tone.ToneAudioNode) => {
    const { eq } = currentEffects;
    if (!eq || !eq.gain_values.some((v: number) => v !== 1)) return null;

    const eqGains = eq.gain_values.map((value: number)=> {
      const gain = new Tone.Gain(value);
      needToDispose.push(gain);
      return gain;
    });

    const output = new Tone.Gain();
    needToDispose.push(output);
    const multibandMain = new Tone.MultibandSplit(250, 2000);
    needToDispose.push(multibandMain);
    const multibandSub1 = new Tone.MultibandSplit(50, 120);
    needToDispose.push(multibandSub1);
    multibandSub1.low.chain(eqGains[0], output);
    multibandSub1.mid.chain(eqGains[1], output);
    multibandSub1.high.chain(eqGains[2], output);
    multibandMain.low.connect(multibandSub1);
    const multibandSub2 = new Tone.MultibandSplit(500, 1000);
    needToDispose.push(multibandSub2);
    multibandSub2.low.chain(eqGains[3], output);
    multibandSub2.mid.chain(eqGains[4], output);
    multibandSub2.high.chain(eqGains[5], output);
    multibandMain.mid.connect(multibandSub2);
    const multibandSub3 = new Tone.MultibandSplit(6000, 8000);
    needToDispose.push(multibandSub3);
    multibandSub3.low.chain(eqGains[6], output);
    multibandSub3.mid.chain(eqGains[7], output);
    multibandSub3.high.chain(eqGains[8], output);
    multibandMain.high.connect(multibandSub3);

    input.connect(multibandMain);
    return output;
  };

  const clampEnvelopeGain = (v: number) =>
    Math.max(0, Math.min(ENVELOPE_LINEAR_GAIN_CAP, Number(v)));

  const applyVolumeEnvelope = async (
    gainNode: Tone.Gain,
    positionSec: number,
    playDurationSec: number,
  ) => {
    if (!pendingVolumeEnvelope?.points?.length) return;

    const ToneMod = await import('tone');
    const now = ToneMod.now();

    const baseGainRaw = pendingVolumeEnvelope.baseGain ?? 1;
    const baseGain = Number.isFinite(baseGainRaw) ? baseGainRaw : 1;

    // Buffer 기준: [positionSec, positionSec + playDurationSec] 구간만 스케줄
    const startSec = positionSec;
    const endSec = positionSec + playDurationSec;

    const pts = pendingVolumeEnvelope.points
      .filter(([t]) => Number.isFinite(t))
      .map(([t, g]) => [t, clampEnvelopeGain(Number(g))] as [number, number])
      .sort((a, b) => a[0] - b[0]);

    // 시작 시점의 gain을 정한다: startSec 이전의 마지막 포인트가 있으면 그 값, 아니면 첫 포인트 값(또는 1)
    let startGain = 1;
    for (const [t, g] of pts) {
      if (t <= startSec) startGain = g;
      else break;
    }
    if (!Number.isFinite(startGain)) startGain = 1;

    // Tone.Player playbackRate에 따른 wallclock 스케줄 보정
    const rate = currentPlaybackRate || 1;

    // 기존 스케줄 제거 후 시작값 설정
    try {
      gainNode.gain.cancelScheduledValues(now);
    } catch {
      // noop
    }
    gainNode.gain.setValueAtTime(clampEnvelopeGain(startGain * baseGain), now);

    // 구간 내 포인트만 setValueAtTime으로 스케줄 (필요하면 향후 linearRamp로 개선 가능)
    for (const [t, g] of pts) {
      if (t < startSec || t > endSec) continue;
      const wallclockOffset = (t - startSec) / rate;
      gainNode.gain.setValueAtTime(clampEnvelopeGain(g * baseGain), now + wallclockOffset);
    }
  };

  // --- 공개 API ---
  const playSound = async (position = 0, playDuration = -1) => {
    if (!tonePlayer || currentStatus === 'play') return;

    // Safari 백그라운드 복귀 대응: Player 상태 확인 및 복구
    try {
      const Tone = await import('tone');

      // AudioContext가 suspended 상태면 resume
      if (Tone.context.state === 'suspended') {
        await Tone.context.resume();
        console.log('[ShockWave] AudioContext resumed from suspended state');
      }

      // Player가 stopped 상태가 아니면 먼저 정리
      if (tonePlayer.state !== 'stopped') {
        tonePlayer.stop();
      }
    } catch (error) {
      console.error('[ShockWave] Failed to check/resume AudioContext:', error);
    }

    disposeEffects();
    tonePlayer.playbackRate = currentPlaybackRate;

    const input = new Tone.Gain(1.0);
    needToDispose.push(input);
    tonePlayer.connect(input);

    let lastNode: Tone.ToneAudioNode = input;

    const eqEffect = buildEqEffect(lastNode);
    if (eqEffect) lastNode = eqEffect;

    [buildChorusEffect, buildReverbEffect, buildFeedbackDelayEffect, buildPitchShiftEffect].forEach(build => {
      const effectNode = build();
      if (effectNode) {
        lastNode.connect(effectNode);
        lastNode = effectNode;
      }
    });

    // 항상 최종 gain 노드를 두고, (1) currentEffects.gain.value (2) graph 엔벨로프를 여기에 적용한다.
    const staticGainRaw = currentEffects?.gain?.value;
    const staticGain =
      staticGainRaw !== undefined && Number.isFinite(Number(staticGainRaw))
        ? Number(staticGainRaw)
        : 1;
    const outputGain = new Tone.Gain(staticGain);
    needToDispose.push(outputGain);
    lastNode.connect(outputGain);
    lastNode = outputGain;

    lastNode.toDestination();

    currentStatus = 'play';

    const duration = tonePlayer.buffer.duration;
    const effectiveDuration = playDuration === -1 ? duration - position : playDuration;
    if (position < 0 || effectiveDuration < 0) return;

    // graph 엔벨로프 적용 (있는 경우)
    await applyVolumeEnvelope(outputGain, position, effectiveDuration);

    tonePlayer.start(0, position, effectiveDuration);

    const onStop = () => {
      currentStatus = 'stop';
      disposeEffects();
    };

    if (tmrPlaying) clearTimeout(tmrPlaying);
    tmrPlaying = setTimeout(onStop, (effectiveDuration * 1000) / currentPlaybackRate);
    tonePlayer.onstop = onStop;
  };

  return {
    load: async (newUrl: string, initialEffects: any | null = null, autoPlay = false, newPlaybackRate = 1.0) => {
      currentStatus = 'loading';
      currentPlaybackRate = newPlaybackRate;
      stopSound();
      disposeEffects();
      disposePlayer();

      try {
        tonePlayer = new Tone.Player();
        await tonePlayer.load(newUrl);
        const audioBuffer = tonePlayer.buffer.get();
        if (!audioBuffer) throw new Error('Audio buffer is empty.');

        sampleBuffer = [];
        for (let i = 0; i < Math.min(2, audioBuffer.numberOfChannels); i++) {
          sampleBuffer[i] = audioBuffer.getChannelData(i);
        }
        currentEffects = initialEffects || JSON.parse(JSON.stringify(PLAYER_DEFAULT_EFFECT));
        if (autoPlay) await playSound();
        currentStatus = 'stop';
        return true;
      } catch (e) {
        console.warn(`[createShockWave] Skipping undecodable audio (URL: ${newUrl})`, e);
        disposePlayer();
        currentStatus = 'stop';
        return false;
      }
    },
    playSound,
    stopSound,
    /** audio_tracks graph 볼륨 엔벨로프 설정 (버퍼 시간 기준 초 단위) */
    setVolumeEnvelope: (points: Array<[number, number]>, options?: { baseGain?: number }) => {
      pendingVolumeEnvelope = { points, baseGain: options?.baseGain };
    },
    destroy: () => {
      stopSound();
      disposeEffects();
      disposePlayer();
    },
  };
}
