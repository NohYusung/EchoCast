/*
    useRecording.ts
    MediaRecorder API wrapper hook for React
    Handles microphone recording with real-time audio level visualization
    Author: AI Assistant
    Last update: 2025-01-21
*/

import { useState, useCallback, useRef, useEffect } from 'react';

export type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'error';

interface UseRecordingOptions {
  maxDuration?: number; // Maximum recording duration in milliseconds (default: 60000 = 60s)
  mimeType?: string; // Preferred mime type (default: auto-detect)
  audioBitsPerSecond?: number; // Audio bitrate (default: 128000)
  onAudioLevel?: (level: number) => void; // Callback for real-time audio level (0-1)
  onRecordingComplete?: (blob: Blob, url: string) => void;
  onError?: (error: Error) => void;
}

interface UseRecordingReturn {
  // State
  status: RecordingStatus;
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // Current recording duration in milliseconds
  audioLevel: number; // Current audio level (0-1)
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  error: Error | null;

  // Methods
  startRecording: (overrideMaxDuration?: number) => Promise<boolean>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  clearRecording: () => void;

  // Permission
  requestPermission: () => Promise<boolean>;
  hasPermission: boolean;
}

// Supported MIME types in order of preference
const MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
];

function getSupportedMimeType(): string {
  for (const mimeType of MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return ''; // Let browser choose default
}

/** 일부 브라우저는 echoCancellation 등 세부 제약에서 실패하므로 `{ audio: true }`로 한 번 더 시도한다. */
async function getUserMediaAudioWithFallback(): Promise<MediaStream> {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  const getUserMedia = md?.getUserMedia?.bind(md);
  if (!getUserMedia) {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      throw new DOMException(
        'Microphone requires a secure context',
        'SecurityError',
      );
    }
    throw new DOMException(
      'getUserMedia is not available in this environment',
      'NotSupportedError',
    );
  }

  const strict = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  } as const;
  try {
    return await getUserMedia({ audio: strict });
  } catch (first) {
    try {
      return await getUserMedia({ audio: true });
    } catch {
      throw first;
    }
  }
}

export function useRecording(options: UseRecordingOptions = {}): UseRecordingReturn {
  const {
    maxDuration = 60000,
    mimeType: preferredMimeType,
    audioBitsPerSecond = 128000,
    onAudioLevel,
    onRecordingComplete,
    onError,
  } = options;

  // State
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stopRecordingRef = useRef<(() => void) | null>(null);
  /** 취소(초기화) 시 onstop에서 저장/onRecordingComplete 호출 방지 */
  const isCancellingRef = useRef(false);
  /** getUserMedia 대기 중 중복 startRecording 방지 */
  const startAcquisitionLockRef = useRef(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error('[useRecording] Error stopping MediaRecorder:', e);
      }
    }
    mediaRecorderRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.error('[useRecording] Error closing AudioContext:', e);
      }
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
  }, []);

  const recordedUrlRef = useRef<string | null>(null);
  useEffect(() => {
    recordedUrlRef.current = recordedUrl;
  }, [recordedUrl]);

  const revokeUrl = useCallback(() => {
    const currentUrl = recordedUrlRef.current;
    if (currentUrl) {
      try {
        URL.revokeObjectURL(currentUrl);
      } catch (e) {
        console.error('[useRecording] Error revoking URL:', e);
      }
      recordedUrlRef.current = null;
      setRecordedUrl(null);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setStatus('requesting');
      setError(null);
      const stream = await getUserMediaAudioWithFallback();
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      setStatus('idle');
      return true;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to get microphone permission');
      setError(err);
      setHasPermission(false);
      setStatus('error');
      onError?.(err);
      return false;
    }
  }, [onError]);

  const analyzeAudioLevel = useCallback(function analyzeAudioLevelImpl() {
    if (!analyserRef.current || !dataArrayRef.current) return;
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const sum = dataArrayRef.current.reduce((acc, val) => acc + val, 0);
    const average = sum / dataArrayRef.current.length;
    const normalizedLevel = Math.min(1, average / 128);
    setAudioLevel(normalizedLevel);
    onAudioLevel?.(normalizedLevel);
    if (status === 'recording') {
      animationFrameRef.current = requestAnimationFrame(analyzeAudioLevelImpl);
    }
  }, [status, onAudioLevel]);

  const startRecording = useCallback(async (overrideMaxDuration?: number): Promise<boolean> => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      return false;
    }
    if (startAcquisitionLockRef.current) {
      return false;
    }
    const effectiveMaxDurationRaw = overrideMaxDuration ?? maxDuration;
    const effectiveMaxDuration =
      typeof effectiveMaxDurationRaw === 'number' &&
      Number.isFinite(effectiveMaxDurationRaw) &&
      effectiveMaxDurationRaw > 0
        ? effectiveMaxDurationRaw
        : 60000;

    startAcquisitionLockRef.current = true;
    try {
      setStatus('requesting');
      setError(null);
      revokeUrl();
      setRecordedBlob(null);
      chunksRef.current = [];

      const stream = await getUserMediaAudioWithFallback();
      streamRef.current = stream;
      setHasPermission(true);

      audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

      const mimeType = preferredMimeType || getSupportedMimeType();
      const recorderOptions: MediaRecorderOptions = { audioBitsPerSecond };
      if (mimeType) recorderOptions.mimeType = mimeType;

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        if (isCancellingRef.current) {
          isCancellingRef.current = false;
          setRecordedBlob(null);
          setRecordedUrl(null);
          setDuration(0);
          setAudioLevel(0);
          setStatus('idle');
          return;
        }
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedBlob(blob);
          setRecordedUrl(url);
          setStatus('stopped');
          onRecordingComplete?.(blob, url);
        }
      };

      mediaRecorder.onerror = () => {
        setError(new Error('MediaRecorder error'));
        setStatus('error');
        onError?.(new Error('MediaRecorder error'));
        cleanup();
      };

      mediaRecorder.start(100);
      startTimeRef.current = Date.now();
      setDuration(0);
      setStatus('recording');

      durationIntervalRef.current = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);

      animationFrameRef.current = requestAnimationFrame(analyzeAudioLevel);

      if (effectiveMaxDuration > 0) {
        maxDurationTimeoutRef.current = setTimeout(() => {
          stopRecordingRef.current?.();
        }, effectiveMaxDuration);
      }
      return true;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to start recording');
      setError(err);
      setStatus('error');
      setHasPermission(false);
      onError?.(err);
      cleanup();
      return false;
    } finally {
      startAcquisitionLockRef.current = false;
    }
  }, [preferredMimeType, audioBitsPerSecond, maxDuration, onRecordingComplete, onError, cleanup, revokeUrl, analyzeAudioLevel]);

  const stopRecording = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
      startTimeRef.current = Date.now() - duration;
      durationIntervalRef.current = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);
      animationFrameRef.current = requestAnimationFrame(analyzeAudioLevel);
    }
  }, [duration, analyzeAudioLevel]);

  const cancelRecording = useCallback(() => {
    isCancellingRef.current = true;
    chunksRef.current = [];
    cleanup();
    revokeUrl();
    setRecordedBlob(null);
    setDuration(0);
    setAudioLevel(0);
    setStatus('idle');
  }, [cleanup, revokeUrl]);

  const clearRecording = useCallback(() => {
    revokeUrl();
    setRecordedBlob(null);
    setDuration(0);
    setAudioLevel(0);
    setStatus('idle');
  }, [revokeUrl]);

  useEffect(() => {
    return () => {
      cleanup();
      const currentUrl = recordedUrlRef.current;
      if (currentUrl) {
        try {
          URL.revokeObjectURL(currentUrl);
        } catch (e) {
          console.error('[useRecording] Cleanup: Error revoking URL on unmount:', e);
        }
      }
    };
  }, [cleanup]);

  return {
    status,
    isRecording: status === 'recording',
    isPaused: status === 'paused',
    duration,
    audioLevel,
    recordedBlob,
    recordedUrl,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    clearRecording,
    requestPermission,
    hasPermission,
  };
}

export default useRecording;
