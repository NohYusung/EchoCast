'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent as ReactChangeEvent, CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { ToonedBrand } from '../brand/ToonedBrand';
import { uploadFileToPresignedUrl } from '../player/mediaUploadBatch';
import { getAudioDuration } from '../player/audioDuration';
import type { StudioEpisodeDetails } from '../player/getEpisodeDetails';
import { getPlayerDraft } from '../player/getPlayerDraft';
import { getPlayerManifest } from '../player/getPlayerManifest';
import type { PlayerDraft } from '../player/playerDraft.types';
import type { PlayerManifest } from '../player/playerManifest.types';
import { buildRecordCreateRequest, buildRecordingUploadFileRequest, getRecordApiId } from '../player/recordingStudioApi';
import {
    buildRecordingBufferSelectionWaveformPeaks,
    buildRecordingBufferWaveformPeaks,
    concatRecordingBufferChunks,
    encodePcm16Wav,
    getRecordingBufferDurationMs,
    getRecordingBufferWindowStyle,
    moveRecordingBufferSelection,
    recordingCircularBufferMaxMs,
    toRecordingBufferSelection,
    trimRecordingBufferChunks,
} from '../player/recordingCircularBuffer';
import type { RecordingBufferSelection } from '../player/recordingCircularBuffer';
import {
    buildRecordingCueStripMarkers,
    buildRecordingCueQueue,
    filterRecordingCueQueue,
    getRecordingProgress,
    selectInitialRecordingCue,
    toRecordingStripSize,
} from '../player/recordingStudio';
import type { RecordingCueFilter, RecordingCueQueueItem, RecordingTakeSummary } from '../player/recordingStudio';
import { toVisualClips } from '../player/visualClips';
import type { VisualClip } from '../player/visualClips';
import { StudioCatalogIcon } from './StudioCatalogIcon';

type StudioRecordDashboardProps = {
    productId: string;
    episodeId: string;
    draft: PlayerDraft;
    manifest: PlayerManifest;
    episode: StudioEpisodeDetails;
};

type StudioRecordArtist = {
    id: number;
    name: string;
};

type UploadUrlsResponse = {
    data?: Array<{
        publicUrl: string;
        mimetype?: string;
        presignedUrl: string;
    }>;
};

type RecordingBufferStatus = 'starting' | 'ready' | 'error' | 'unsupported';

type RecordingBufferHandle = {
    stream: MediaStream;
    audioContext: AudioContext;
    source: MediaStreamAudioSourceNode;
    processor: ScriptProcessorNode;
    chunks: Float32Array[];
    totalSamples: number;
    sampleRate: number;
};

type PendingRecordingBuffer = {
    cue: RecordingCueQueueItem;
    artistId?: string;
    samples: Float32Array;
    sampleRate: number;
    bufferDurationMs: number;
    wave: number[];
    selection: RecordingBufferSelection;
};

type RecordingBufferPreviewOptions = {
    autoplay?: boolean;
};

const filterLabels: Record<RecordingCueFilter, string> = {
    all: '전체',
    pending: '대기',
    done: '완료',
};

const RECORD_WAVEFORM_BAR_COUNT = 300;
const EXTERNAL_RECORD_ACCEPT = 'audio/*,.mp3,.m4a,.wav,.ogg,.webm';

export function StudioRecordDashboard({ productId, episodeId, draft, manifest, episode }: StudioRecordDashboardProps) {
    const apiBaseUrl = useMemo(() => getClientApiBaseUrl(), []);
    const productNumericId = useMemo(() => Number.parseInt(productId, 10) || 0, [productId]);
    const episodeNumericId = useMemo(() => Number.parseInt(episodeId, 10) || 0, [episodeId]);
    const [draftState, setDraftState] = useState(draft);
    const [manifestState, setManifestState] = useState(manifest);
    const allQueue = useMemo(() => buildRecordingCueQueue({ draft: draftState, manifest: manifestState }), [draftState, manifestState]);
    const product =
        draftState.products.find((item) => item.id === productNumericId) ??
        draftState.products[0] ??
        { id: productNumericId, title: `작품 ${productId}` };
    const draftEpisode = draftState.episodes.find((item) => item.id === episodeNumericId);
    const episodeTitle = episode.title || draftEpisode?.title || `에피소드 ${episodeId}`;
    const availableCharacters = useMemo(() => {
        const characterIds = new Set(allQueue.map((item) => item.characterId));
        const characters = draftState.characters.filter((character) => characterIds.has(character.id));
        return characters.length > 0 ? characters : draftState.characters;
    }, [allQueue, draftState.characters]);
    const availableCharacterIds = useMemo(() => availableCharacters.map((character) => character.id), [availableCharacters]);
    const [selectedCharacterIds, setSelectedCharacterIds] = useState(() => draft.characters.map((character) => character.id));
    const [selectedArtistId, setSelectedArtistId] = useState('');
    const [artists] = useState<StudioRecordArtist[]>([]);
    const [filter, setFilter] = useState<RecordingCueFilter>('all');
    const [selectedCueId, setSelectedCueId] = useState<number | undefined>();
    const [recordingStripScale, setRecordingStripScale] = useState(100);
    const [isRecording, setIsRecording] = useState(false);
    const [isSavingRecord, setIsSavingRecord] = useState(false);
    const [recordingStartedAt, setRecordingStartedAt] = useState<number | undefined>();
    const [recordingMs, setRecordingMs] = useState(0);
    const [recordingBufferStatus, setRecordingBufferStatus] = useState<RecordingBufferStatus>('starting');
    const [recordingBufferMs, setRecordingBufferMs] = useState(0);
    const [recordingBufferWave, setRecordingBufferWave] = useState<number[]>([]);
    const [pendingRecordingBuffer, setPendingRecordingBuffer] = useState<PendingRecordingBuffer | undefined>();
    const [isRecordingBufferPreviewPlaying, setIsRecordingBufferPreviewPlaying] = useState(false);
    const [focusedRecordKey, setFocusedRecordKey] = useState<string | undefined>();
    const [playingRecordKey, setPlayingRecordKey] = useState<string | undefined>();
    const [isRecordPlaybackPaused, setIsRecordPlaybackPaused] = useState(false);
    const [recordPlaybackProgress, setRecordPlaybackProgress] = useState(0);
    const [recordWaveforms, setRecordWaveforms] = useState<Record<string, number[]>>({});
    const [loadingWaveformKey, setLoadingWaveformKey] = useState<string | undefined>();
    const [message, setMessage] = useState('');
    const externalRecordInputRef = useRef<HTMLInputElement | null>(null);
    const waveformRef = useRef<HTMLDivElement | null>(null);
    const recordingBufferTrimRef = useRef<HTMLDivElement | null>(null);
    const recordPlaybackRef = useRef<HTMLAudioElement | null>(null);
    const recordingBufferPreviewRef = useRef<HTMLAudioElement | null>(null);
    const recordingBufferPreviewUrlRef = useRef<string | undefined>(undefined);
    const recordPlaybackFrameRef = useRef<number | undefined>(undefined);
    const recordPlaybackSeekRef = useRef<{ recordKey: string; seconds: number } | undefined>(undefined);
    const recordPlaybackProgressRef = useRef(0);
    const recordPlaybackProgressStateSyncedAtRef = useRef(0);
    const recordingBufferRef = useRef<RecordingBufferHandle | null>(null);
    const recordingBufferDragOffsetMsRef = useRef<number | undefined>(undefined);
    const isRecordComponentMountedRef = useRef(false);
    const recordingCueRef = useRef<RecordingCueQueueItem | undefined>(undefined);
    const recordingArtistIdRef = useRef<string | undefined>(undefined);
    const recordingStartedAtRef = useRef<number | undefined>(undefined);
    const recordingTargetDurationMsRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        setDraftState(draft);
    }, [draft]);

    useEffect(() => {
        setManifestState(manifest);
    }, [manifest]);

    useEffect(() => {
        setSelectedCharacterIds((current) => {
            if (availableCharacterIds.length === 0) return [];

            const nextSelectedIds = normalizeSelectedCharacterIds({
                selectedCharacterIds: current,
                availableCharacterIds,
                fallbackToAll: true,
            });

            if (nextSelectedIds.length === current.length && nextSelectedIds.every((characterId, index) => characterId === current[index])) {
                return current;
            }

            return nextSelectedIds;
        });
    }, [availableCharacterIds]);

    const selectedAvailableCharacterIds = useMemo(
        () =>
            normalizeSelectedCharacterIds({
                selectedCharacterIds,
                availableCharacterIds,
                fallbackToAll: false,
            }),
        [availableCharacterIds, selectedCharacterIds],
    );
    const selectedAvailableCharacterIdSet = useMemo(() => new Set(selectedAvailableCharacterIds), [selectedAvailableCharacterIds]);
    const queue = useMemo(() => allQueue.filter((item) => selectedAvailableCharacterIdSet.has(item.characterId)), [allQueue, selectedAvailableCharacterIdSet]);
    const visibleQueue = useMemo(() => filterRecordingCueQueue(queue, filter), [filter, queue]);
    const progress = useMemo(() => getRecordingProgress(queue), [queue]);
    const selectedCue = queue.find((item) => item.cueId === selectedCueId) ?? selectInitialRecordingCue(queue);
    const selectedRecords = selectedCue?.records ?? [];
    const focusedRecord =
        selectedRecords.find((record) => getRecordingTakeKey(record) === focusedRecordKey) ??
        selectedRecords.find((record) => record.isAccepted) ??
        getLatestRecordingTake(selectedRecords);
    const activeFocusedRecordKey = focusedRecord ? getRecordingTakeKey(focusedRecord) : undefined;
    const isFocusedRecordPlaying =
        typeof activeFocusedRecordKey === 'string' &&
        playingRecordKey === activeFocusedRecordKey &&
        !isRecordPlaybackPaused;
    const isTransportPlaybackActive = pendingRecordingBuffer ? isRecordingBufferPreviewPlaying : isFocusedRecordPlaying;
    const activeRecordWaveform = activeFocusedRecordKey ? recordWaveforms[activeFocusedRecordKey] : undefined;
    const isWaveformLoading = Boolean(activeFocusedRecordKey && loadingWaveformKey === activeFocusedRecordKey);
    const stripClips = useMemo(() => getRecordStripClips({ draft: draftState, manifest: manifestState }), [draftState, manifestState]);
    const stripCueMarkers = useMemo(() => buildRecordingCueStripMarkers({ queue: allQueue, selectedCueId: selectedCue?.cueId }), [allQueue, selectedCue?.cueId]);
    const stripCueMarkersByCanvasMediaId = useMemo(() => {
        const markers = new Map<number, typeof stripCueMarkers>();

        for (const marker of stripCueMarkers) {
            if (typeof marker.canvasMediaId !== 'number') continue;

            const current = markers.get(marker.canvasMediaId) ?? [];
            current.push(marker);
            markers.set(marker.canvasMediaId, current);
        }

        return markers;
    }, [stripCueMarkers]);
    const unplacedStripCueMarkers = useMemo(
        () => stripCueMarkers.filter((marker) => typeof marker.canvasMediaId !== 'number'),
        [stripCueMarkers],
    );
    const selectedCueMarker = stripCueMarkers.find((marker) => marker.isSelected);
    const recordingStripSize = toRecordingStripSize(recordingStripScale);
    const recordWorkspaceStyle = {
        '--tr-record-strip-panel-width': `${recordingStripSize.panelWidth}px`,
        '--tr-record-strip-width': `${recordingStripSize.width}px`,
        '--tr-record-strip-fallback-height': `${recordingStripSize.fallbackHeight}px`,
    } as CSSProperties;
    const cueCountByCharacterId = useMemo(() => {
        const counts = new Map<number, number>();

        for (const item of allQueue) {
            counts.set(item.characterId, (counts.get(item.characterId) ?? 0) + 1);
        }

        return counts;
    }, [allQueue]);
    const isAllCharactersSelected = availableCharacters.length > 0 && selectedAvailableCharacterIds.length === availableCharacters.length;
    const pendingRecordingBufferWindow = pendingRecordingBuffer
        ? getRecordingBufferWindowStyle(pendingRecordingBuffer.selection, pendingRecordingBuffer.bufferDurationMs)
        : undefined;
    const pendingRecordingSelectedWave = pendingRecordingBuffer
        ? buildRecordingBufferSelectionWaveformPeaks({
              samples: pendingRecordingBuffer.samples,
              sampleRate: pendingRecordingBuffer.sampleRate,
              selection: pendingRecordingBuffer.selection,
              count: RECORD_WAVEFORM_BAR_COUNT,
          })
        : [];
    const hasRecordWaveform = isRecording || Boolean(pendingRecordingBuffer) || Boolean(focusedRecord?.audioUrl);
    const currentWave = isRecording
        ? recordingBufferWave.length > 0
            ? recordingBufferWave
            : createWave(recordingMs, RECORD_WAVEFORM_BAR_COUNT)
        : pendingRecordingBuffer
          ? pendingRecordingSelectedWave
          : focusedRecord?.audioUrl
            ? activeRecordWaveform ?? createWave(focusedRecord.audioUrl, RECORD_WAVEFORM_BAR_COUNT)
            : [];
    const waveformDurationMs = isRecording
        ? recordingMs
        : pendingRecordingBuffer
          ? pendingRecordingBuffer.selection.durationMs
          : focusedRecord
            ? getRecordDisplayDurationMs(focusedRecord)
            : 0;
    const waveformProgressPercent = isRecording
        ? 0
        : Math.round(Math.min(1, Math.max(0, recordPlaybackProgress)) * 10000) / 100;
    const waveformStyle = {
        '--tr-waveform-bar-count': currentWave.length,
        '--tr-waveform-progress': `${waveformProgressPercent}%`,
    } as CSSProperties;
    useEffect(() => {
        if (!selectedCue || selectedCue.cueId === selectedCueId) return;
        setSelectedCueId(selectedCue.cueId);
    }, [selectedCue, selectedCueId]);

    useEffect(() => {
        isRecordComponentMountedRef.current = true;
        void startRecordingBuffer();

        const intervalId = window.setInterval(() => {
            const snapshot = snapshotRecordingBuffer();

            if (!snapshot) {
                setRecordingBufferMs(0);
                setRecordingBufferWave([]);
                return;
            }

            setRecordingBufferMs(snapshot.bufferDurationMs);
            setRecordingBufferWave(snapshot.wave);
        }, 240);

        return () => {
            isRecordComponentMountedRef.current = false;
            window.clearInterval(intervalId);
            stopRecordingBuffer();
            stopRecordingBufferPreview();
        };
    }, []);

    useEffect(() => {
        if (!isRecording || typeof recordingStartedAt !== 'number') return;

        const intervalId = window.setInterval(() => {
            const elapsedMs = Date.now() - recordingStartedAt;
            setRecordingMs(elapsedMs);
        }, 120);

        return () => window.clearInterval(intervalId);
    }, [isRecording, recordingStartedAt]);

    useEffect(() => {
        syncRecordPlaybackProgress(0, { syncState: true });
    }, [activeFocusedRecordKey]);

    useEffect(() => {
        if (!focusedRecord?.audioUrl || !activeFocusedRecordKey || activeRecordWaveform) return;

        let isCancelled = false;
        setLoadingWaveformKey(activeFocusedRecordKey);
        void buildRecordWaveformPeaks(focusedRecord.audioUrl, RECORD_WAVEFORM_BAR_COUNT, getRecordPlaybackRangeMs(focusedRecord))
            .then((peaks) => {
                if (isCancelled) return;

                setRecordWaveforms((current) =>
                    current[activeFocusedRecordKey] ? current : { ...current, [activeFocusedRecordKey]: peaks },
                );
            })
            .catch(() => {
                if (isCancelled) return;

                setRecordWaveforms((current) =>
                    current[activeFocusedRecordKey]
                        ? current
                        : { ...current, [activeFocusedRecordKey]: createWave(focusedRecord.audioUrl, RECORD_WAVEFORM_BAR_COUNT) },
                );
            })
            .finally(() => {
                if (!isCancelled) {
                    setLoadingWaveformKey((current) => (current === activeFocusedRecordKey ? undefined : current));
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [activeFocusedRecordKey, activeRecordWaveform, focusedRecord]);

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            if (typeof recordingBufferDragOffsetMsRef.current !== 'number') return;

            updatePendingRecordingBufferSelectionFromPointer(event.clientX, recordingBufferDragOffsetMsRef.current);
        };
        const handlePointerUp = () => {
            recordingBufferDragOffsetMsRef.current = undefined;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, []);

    useEffect(() => {
        return () => {
            cancelRecordPlaybackFrame();
            recordPlaybackRef.current?.pause();
            recordPlaybackRef.current = null;
        };
    }, []);

    async function refreshRecordingData() {
        const [nextDraft, nextManifest] = await Promise.all([
            getPlayerDraft({ productId, episodeId }),
            getPlayerManifest(episodeId),
        ]);

        setDraftState(nextDraft);
        setManifestState(nextManifest);

        return { draft: nextDraft, manifest: nextManifest };
    }

    async function startRecordingBuffer() {
        if (recordingBufferRef.current) return;

        if (!navigator.mediaDevices?.getUserMedia) {
            setRecordingBufferStatus('unsupported');
            return;
        }

        const AudioContextConstructor = getAudioContextConstructor();
        if (!AudioContextConstructor) {
            setRecordingBufferStatus('unsupported');
            return;
        }

        let stream: MediaStream | undefined;
        let audioContext: AudioContext | undefined;

        try {
            setRecordingBufferStatus('starting');
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new AudioContextConstructor();
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(2048, 1, 1);
            const handle: RecordingBufferHandle = {
                stream,
                audioContext,
                source,
                processor,
                chunks: [],
                totalSamples: 0,
                sampleRate: audioContext.sampleRate,
            };

            processor.onaudioprocess = (event) => {
                const input = event.inputBuffer.getChannelData(0);
                const output = event.outputBuffer.getChannelData(0);
                const chunk = new Float32Array(input.length);

                chunk.set(input);
                output.fill(0);
                handle.chunks.push(chunk);
                handle.totalSamples += chunk.length;
                handle.totalSamples = trimRecordingBufferChunks({
                    chunks: handle.chunks,
                    totalSamples: handle.totalSamples,
                    maxSamples: Math.max(1, Math.round((handle.sampleRate * recordingCircularBufferMaxMs) / 1000)),
                });
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
            void audioContext.resume().catch(() => undefined);

            if (!isRecordComponentMountedRef.current) {
                processor.disconnect();
                source.disconnect();
                stopRecordingStream(stream);
                void audioContext.close();
                return;
            }

            recordingBufferRef.current = handle;
            setRecordingBufferStatus('ready');
        } catch (error) {
            if (stream) {
                stopRecordingStream(stream);
            }
            if (audioContext) {
                void audioContext.close().catch(() => undefined);
            }
            setRecordingBufferStatus('error');
            setMessage(toRecordErrorMessage(error, '녹음 버퍼를 시작하지 못했습니다.'));
        }
    }

    function stopRecordingBuffer() {
        const handle = recordingBufferRef.current;
        if (!handle) return;

        handle.processor.onaudioprocess = null;
        handle.processor.disconnect();
        handle.source.disconnect();
        stopRecordingStream(handle.stream);
        void handle.audioContext.close().catch(() => undefined);
        recordingBufferRef.current = null;
    }

    function snapshotRecordingBuffer() {
        const handle = recordingBufferRef.current;
        if (!handle || handle.totalSamples <= 0) return undefined;

        const samples = concatRecordingBufferChunks(handle.chunks);
        const bufferDurationMs = getRecordingBufferDurationMs(samples.length, handle.sampleRate);

        return {
            samples,
            sampleRate: handle.sampleRate,
            bufferDurationMs,
            wave: buildRecordingBufferWaveformPeaks(samples, RECORD_WAVEFORM_BAR_COUNT),
        };
    }

    function updatePendingRecordingBufferSelectionFromPointer(clientX: number, dragOffsetMs: number) {
        const trimElement = recordingBufferTrimRef.current;
        if (!trimElement) return;

        stopRecordingBufferPreview();

        const rect = trimElement.getBoundingClientRect();
        if (rect.width <= 0) return;

        const pointerRatio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        setPendingRecordingBuffer((current) => {
            if (!current) return current;

            const startMs = pointerRatio * current.bufferDurationMs - dragOffsetMs;
            return {
                ...current,
                selection: moveRecordingBufferSelection({
                    bufferDurationMs: current.bufferDurationMs,
                    selectionDurationMs: current.selection.durationMs,
                    startRatio: startMs / Math.max(1, current.bufferDurationMs),
                }),
            };
        });
    }

    function placePendingRecordingBufferSelection(event: ReactPointerEvent<HTMLDivElement>) {
        if (event.button !== 0 || !pendingRecordingBuffer) return;

        updatePendingRecordingBufferSelectionFromPointer(event.clientX, pendingRecordingBuffer.selection.durationMs / 2);
    }

    function startPendingRecordingBufferSelectionDrag(event: ReactPointerEvent<HTMLDivElement>) {
        if (event.button !== 0 || !pendingRecordingBuffer) return;

        event.stopPropagation();
        const trimElement = recordingBufferTrimRef.current;
        if (!trimElement) return;

        const rect = trimElement.getBoundingClientRect();
        const pointerRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
        const pointerMs = pointerRatio * pendingRecordingBuffer.bufferDurationMs;
        recordingBufferDragOffsetMsRef.current = Math.max(0, pointerMs - pendingRecordingBuffer.selection.startMs);
    }

    function previewPendingRecordingBuffer(startSeconds = 0, options?: RecordingBufferPreviewOptions) {
        if (!pendingRecordingBuffer) return;

        stopRecordPlayback();
        stopRecordingBufferPreview();

        const startSample = Math.max(0, Math.floor((pendingRecordingBuffer.selection.startMs / 1000) * pendingRecordingBuffer.sampleRate));
        const endSample = Math.min(
            pendingRecordingBuffer.samples.length,
            Math.ceil((pendingRecordingBuffer.selection.endMs / 1000) * pendingRecordingBuffer.sampleRate),
        );
        const previewSamples = pendingRecordingBuffer.samples.slice(startSample, endSample);
        const previewBlob = encodePcm16Wav(previewSamples, pendingRecordingBuffer.sampleRate);
        const previewUrl = URL.createObjectURL(previewBlob);
        const audio = new Audio(previewUrl);
        const durationSeconds = pendingRecordingBuffer.selection.durationMs / 1000;
        const previewStartSeconds = Math.min(durationSeconds, Math.max(0, startSeconds));

        recordingBufferPreviewRef.current = audio;
        recordingBufferPreviewUrlRef.current = previewUrl;
        syncRecordPlaybackProgress(durationSeconds > 0 ? previewStartSeconds / durationSeconds : 0, { syncState: true });
        const applyPreviewStart = () => {
            audio.currentTime = previewStartSeconds;
            updateRecordingBufferPreviewProgress(audio, pendingRecordingBuffer.selection.durationMs);
        };
        audio.onloadedmetadata = applyPreviewStart;
        audio.ontimeupdate = () => updateRecordingBufferPreviewProgress(audio, pendingRecordingBuffer.selection.durationMs);
        audio.onended = stopRecordingBufferPreview;
        audio.onerror = () => {
            stopRecordingBufferPreview();
            setMessage('버퍼 미리듣기를 재생하지 못했습니다.');
        };
        try {
            applyPreviewStart();
        } catch {
            // loadedmetadata에서 다시 적용한다.
        }
        if (options?.autoplay === false) {
            setIsRecordingBufferPreviewPlaying(false);
            return;
        }

        void audio
            .play()
            .then(() => {
                if (recordingBufferPreviewRef.current === audio) {
                    setIsRecordingBufferPreviewPlaying(true);
                }
            })
            .catch((error: unknown) => {
                stopRecordingBufferPreview();
                setMessage(toRecordErrorMessage(error, '버퍼 미리듣기를 재생하지 못했습니다.'));
            });
    }

    function resumeRecordingBufferPreview() {
        const audio = recordingBufferPreviewRef.current;
        if (!audio || !pendingRecordingBuffer) {
            previewPendingRecordingBuffer();
            return;
        }

        void audio
            .play()
            .then(() => {
                if (recordingBufferPreviewRef.current === audio) {
                    setIsRecordingBufferPreviewPlaying(true);
                    updateRecordingBufferPreviewProgress(audio, pendingRecordingBuffer.selection.durationMs);
                }
            })
            .catch((error: unknown) => {
                stopRecordingBufferPreview();
                setMessage(toRecordErrorMessage(error, '버퍼 미리듣기를 재생하지 못했습니다.'));
            });
    }

    function pauseRecordingBufferPreview() {
        const audio = recordingBufferPreviewRef.current;
        if (!audio) return;

        audio.pause();
        if (isRecordComponentMountedRef.current) {
            setIsRecordingBufferPreviewPlaying(false);
            updateRecordingBufferPreviewProgress(audio, pendingRecordingBuffer?.selection.durationMs ?? 0);
        }
    }

    function stopRecordingBufferPreview() {
        const audio = recordingBufferPreviewRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.onloadedmetadata = null;
            audio.ontimeupdate = null;
            audio.onended = null;
            audio.onerror = null;
        }

        if (recordingBufferPreviewUrlRef.current) {
            URL.revokeObjectURL(recordingBufferPreviewUrlRef.current);
        }

        recordingBufferPreviewRef.current = null;
        recordingBufferPreviewUrlRef.current = undefined;
        if (isRecordComponentMountedRef.current) {
            setIsRecordingBufferPreviewPlaying(false);
            syncRecordPlaybackProgress(0, { syncState: true });
        }
    }

    async function startRecording() {
        if (!selectedCue) return;

        const targetDurationMs = Math.round(selectedCue.durationMs);
        if (!Number.isFinite(targetDurationMs) || targetDurationMs <= 0) {
            setMessage('대사 녹음 길이가 필요합니다.');
            return;
        }

        try {
            setMessage('');
            if (!recordingBufferRef.current) {
                await startRecordingBuffer();
            }

            const recordingBuffer = recordingBufferRef.current;
            if (!recordingBuffer) {
                setMessage(
                    recordingBufferStatus === 'unsupported'
                        ? '현재 브라우저가 녹음 버퍼를 지원하지 않습니다.'
                        : '녹음 버퍼를 준비하지 못했습니다.',
                );
                return;
            }

            await recordingBuffer.audioContext.resume().catch(() => undefined);
            stopRecordPlayback();
            stopRecordingBufferPreview();
            const startedAt = Date.now();

            recordingCueRef.current = selectedCue;
            recordingArtistIdRef.current = selectedArtistId || undefined;
            recordingStartedAtRef.current = startedAt;
            recordingTargetDurationMsRef.current = targetDurationMs;
            setPendingRecordingBuffer(undefined);
            setRecordingStartedAt(startedAt);
            setRecordingMs(0);
            setIsRecording(true);
        } catch (error) {
            setMessage(toRecordErrorMessage(error, '마이크 권한을 확인할 수 없습니다.'));
        }
    }

    function stopRecording() {
        if (!isRecording) {
            return;
        }

        const cue = recordingCueRef.current;
        const artistId = recordingArtistIdRef.current;
        const targetDurationMs = recordingTargetDurationMsRef.current;
        const snapshot = snapshotRecordingBuffer();

        setIsRecording(false);
        setRecordingStartedAt(undefined);
        setRecordingMs(0);
        recordingStartedAtRef.current = undefined;
        recordingTargetDurationMsRef.current = undefined;

        if (!cue || !snapshot || snapshot.samples.length === 0 || snapshot.bufferDurationMs <= 0) {
            setMessage('저장할 녹음 버퍼가 없습니다.');
            return;
        }

        const selection = toRecordingBufferSelection({
            bufferDurationMs: snapshot.bufferDurationMs,
            targetDurationMs:
                typeof targetDurationMs === 'number' && targetDurationMs > 0
                    ? targetDurationMs
                    : Math.max(1, cue.durationMs),
        });

        setPendingRecordingBuffer({
            cue,
            artistId,
            samples: snapshot.samples,
            sampleRate: snapshot.sampleRate,
            bufferDurationMs: snapshot.bufferDurationMs,
            wave: snapshot.wave,
            selection,
        });
        setMessage('녹음 버퍼에서 저장할 구간을 확인한 뒤 저장하세요.');
    }

    async function uploadRecordFile({
        cue,
        artistId,
        recordFile,
        durationMs,
        contentType,
    }: {
        cue: RecordingCueQueueItem;
        artistId?: string;
        recordFile: Blob;
        durationMs: number;
        contentType: string;
    }) {
        const uploadRequest = buildRecordingUploadFileRequest({
            productId,
            episodeId,
            cueId: cue.cueId,
            recordedAtMs: Date.now(),
            contentType,
        });
        const uploadUrl = await requestRecordingUploadUrl(apiBaseUrl, uploadRequest);

        await uploadFileToPresignedUrl(uploadUrl.presignedUrl, recordFile, uploadUrl.mimetype || uploadRequest.contentType);

        const createRequest = buildRecordCreateRequest({
            cueId: cue.cueId,
            artistId,
            recordUrl: uploadUrl.publicUrl,
            durationMs,
            isAccepted: true,
        });
        const createResponse = await fetch(`${apiBaseUrl}/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createRequest),
        });

        if (!createResponse.ok) {
            throw new Error(`Record create failed: ${createResponse.status}`);
        }
    }

    async function focusLatestRecordForCue(cueId: number) {
        const nextData = await refreshRecordingData();
        const nextCue = buildRecordingCueQueue({ draft: nextData.draft, manifest: nextData.manifest }).find(
            (item) => item.cueId === cueId,
        );
        const nextRecord = getLatestRecordingTake(nextCue?.records ?? []);

        if (nextRecord) {
            setFocusedRecordKey(getRecordingTakeKey(nextRecord));
        }
        setSelectedCueId(cueId);
    }

    async function savePendingRecordingBuffer() {
        if (!pendingRecordingBuffer) return;

        try {
            setIsSavingRecord(true);
            setMessage('');
            stopRecordingBufferPreview();

            const recordFile = encodePcm16Wav(pendingRecordingBuffer.samples, pendingRecordingBuffer.sampleRate);
            await uploadRecordFile({
                cue: pendingRecordingBuffer.cue,
                artistId: pendingRecordingBuffer.artistId,
                recordFile,
                durationMs: pendingRecordingBuffer.bufferDurationMs,
                contentType: recordFile.type,
            });

            const nextData = await refreshRecordingData();
            const updatedCue = nextData.draft.cues.find((cue) => cue.id === pendingRecordingBuffer.cue.cueId);
            if (!updatedCue?.audioId) {
                throw new Error('저장된 녹음의 audioId를 확인할 수 없습니다.');
            }

            await updateCueAudioRange({
                apiBaseUrl,
                trackId: updatedCue.trackId,
                cueId: updatedCue.id,
                audioId: updatedCue.audioId,
                audioStartTime: pendingRecordingBuffer.selection.startMs,
                audioEndTime: pendingRecordingBuffer.selection.endMs,
            });
            await focusLatestRecordForCue(pendingRecordingBuffer.cue.cueId);
            setPendingRecordingBuffer(undefined);
            setMessage('선택한 버퍼 구간을 녹음으로 저장했습니다.');
        } catch (error) {
            setMessage(toRecordErrorMessage(error, '녹음 저장에 실패했습니다.'));
        } finally {
            recordingCueRef.current = undefined;
            recordingArtistIdRef.current = undefined;
            recordingStartedAtRef.current = undefined;
            recordingTargetDurationMsRef.current = undefined;
            setIsSavingRecord(false);
        }
    }

    async function importExternalRecordFile(file: File) {
        if (!selectedCue) {
            setMessage('녹음을 등록할 대사를 먼저 선택해 주세요.');
            return;
        }

        try {
            setIsSavingRecord(true);
            setMessage('');
            stopRecordPlayback();

            const durationMs = await getAudioDuration(file);
            if (typeof durationMs !== 'number' || durationMs <= 0) {
                throw new Error('파일 길이를 확인할 수 없습니다.');
            }

            await uploadRecordFile({
                cue: selectedCue,
                artistId: selectedArtistId || undefined,
                recordFile: file,
                durationMs,
                contentType: getExternalRecordContentType(file),
            });
            await focusLatestRecordForCue(selectedCue.cueId);
            setMessage('외부 녹음 파일을 등록했습니다.');
        } catch (error) {
            setMessage(toRecordErrorMessage(error, '외부 녹음 파일 등록에 실패했습니다.'));
        } finally {
            setIsSavingRecord(false);
        }
    }

    function openExternalRecordPicker() {
        if (!selectedCue) {
            setMessage('녹음을 등록할 대사를 먼저 선택해 주세요.');
            return;
        }

        externalRecordInputRef.current?.click();
    }

    function handleExternalRecordFileChange(event: ReactChangeEvent<HTMLInputElement>) {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';

        if (!file) return;

        void importExternalRecordFile(file);
    }

    async function acceptRecord(record: RecordingTakeSummary) {
        const recordApiId = getMutableRecordApiId(record);
        if (!recordApiId) return;

        try {
            setIsSavingRecord(true);
            setMessage('');
            const response = await fetch(`${apiBaseUrl}/records/${recordApiId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isAccepted: true }),
            });

            if (!response.ok) {
                throw new Error(`Record update failed: ${response.status}`);
            }

            await refreshRecordingData();
            setFocusedRecordKey(getRecordingTakeKey(record));
            setMessage('선택한 테이크를 채택했습니다.');
        } catch (error) {
            setMessage(toRecordErrorMessage(error, '테이크 채택에 실패했습니다.'));
        } finally {
            setIsSavingRecord(false);
        }
    }

    async function deleteRecord(record: RecordingTakeSummary) {
        const recordApiId = getMutableRecordApiId(record);
        if (!recordApiId) return;

        try {
            setIsSavingRecord(true);
            setMessage('');
            const response = await fetch(`${apiBaseUrl}/records/${recordApiId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`Record delete failed: ${response.status}`);
            }

            if (focusedRecordKey === getRecordingTakeKey(record)) {
                stopRecordPlayback();
                setFocusedRecordKey(undefined);
            }

            await refreshRecordingData();
            setMessage('테이크를 삭제했습니다.');
        } catch (error) {
            setMessage(toRecordErrorMessage(error, '테이크 삭제에 실패했습니다.'));
        } finally {
            setIsSavingRecord(false);
        }
    }

    function toggleRecordPlayback(record: RecordingTakeSummary | undefined = focusedRecord) {
        if (!record) return;
        if (!record.audioUrl) {
            setMessage('녹음 파일이 없는 테이크는 재생할 수 없습니다.');
            return;
        }

        const recordKey = getRecordingTakeKey(record);
        const currentAudio = recordPlaybackRef.current;
        if (playingRecordKey === recordKey && currentAudio) {
            if (currentAudio.paused) {
                void currentAudio
                    .play()
                    .then(() => {
                        setIsRecordPlaybackPaused(false);
                        startRecordPlaybackProgressLoop(currentAudio, record);
                    })
                    .catch((error: unknown) => setMessage(toRecordErrorMessage(error, '테이크를 재생하지 못했습니다.')));
                return;
            }

            currentAudio.pause();
            cancelRecordPlaybackFrame();
            updateRecordPlaybackProgressForRecord(currentAudio, record);
            setIsRecordPlaybackPaused(true);
            return;
        }

        stopRecordPlayback();

        const audio = new Audio(record.audioUrl);
        audio.volume = Math.min(Math.max(record.volume, 0), 1);
        applyPendingRecordPlaybackSeek(audio, recordKey, record);
        audio.ontimeupdate = () => updateRecordPlaybackProgressForRecord(audio, record);
        audio.onloadedmetadata = () => updateRecordPlaybackProgressForRecord(audio, record);
        audio.onended = () => {
            if (recordPlaybackRef.current !== audio) return;

            recordPlaybackRef.current = null;
            recordPlaybackSeekRef.current = undefined;
            setPlayingRecordKey(undefined);
            setIsRecordPlaybackPaused(false);
            syncRecordPlaybackProgress(1, { syncState: true });
        };
        audio.onerror = () => {
            if (recordPlaybackRef.current === audio) {
                recordPlaybackRef.current = null;
            }
            recordPlaybackSeekRef.current = undefined;
            setPlayingRecordKey(undefined);
            setIsRecordPlaybackPaused(false);
            syncRecordPlaybackProgress(0, { syncState: true });
            setMessage('테이크를 재생하지 못했습니다.');
        };

        recordPlaybackRef.current = audio;
        setFocusedRecordKey(recordKey);
        setPlayingRecordKey(recordKey);
        setIsRecordPlaybackPaused(false);
        updateRecordPlaybackProgressForRecord(audio, record);
        void audio.play().catch((error: unknown) => {
            if (recordPlaybackRef.current === audio) {
                recordPlaybackRef.current = null;
            }
            recordPlaybackSeekRef.current = undefined;
            setPlayingRecordKey(undefined);
            setIsRecordPlaybackPaused(false);
            syncRecordPlaybackProgress(0, { syncState: true });
            setMessage(toRecordErrorMessage(error, '테이크를 재생하지 못했습니다.'));
        }).then(() => {
            if (recordPlaybackRef.current === audio) {
                startRecordPlaybackProgressLoop(audio, record);
            }
        });
    }

    function toggleTransportPlayback() {
        if (pendingRecordingBuffer) {
            if (isRecordingBufferPreviewPlaying) {
                pauseRecordingBufferPreview();
                return;
            }

            if (recordingBufferPreviewRef.current) {
                resumeRecordingBufferPreview();
                return;
            }

            previewPendingRecordingBuffer();
            return;
        }

        toggleRecordPlayback();
    }

    function stopTransport() {
        if (isRecording) {
            stopRecording();
            return;
        }

        if (isRecordingBufferPreviewPlaying) {
            stopRecordingBufferPreview();
            return;
        }

        stopRecordPlayback();
    }

    function stopRecordPlayback() {
        const audio = recordPlaybackRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.ontimeupdate = null;
            audio.onloadedmetadata = null;
            audio.onended = null;
            audio.onerror = null;
        }

        cancelRecordPlaybackFrame();
        recordPlaybackRef.current = null;
        recordPlaybackSeekRef.current = undefined;
        setPlayingRecordKey(undefined);
        setIsRecordPlaybackPaused(false);
        syncRecordPlaybackProgress(0, { syncState: true });
    }

    function startRecordPlaybackProgressLoop(audio: HTMLAudioElement, record: RecordingTakeSummary | undefined) {
        cancelRecordPlaybackFrame();

        const tick = () => {
            if (recordPlaybackRef.current !== audio) return;

            updateRecordPlaybackProgressForRecord(audio, record);
            if (stopRecordPlaybackAtRangeEnd(audio, record)) return;
            if (!audio.paused && !audio.ended) {
                recordPlaybackFrameRef.current = window.requestAnimationFrame(tick);
            }
        };

        tick();
    }

    function cancelRecordPlaybackFrame() {
        if (typeof recordPlaybackFrameRef.current !== 'number') return;

        window.cancelAnimationFrame(recordPlaybackFrameRef.current);
        recordPlaybackFrameRef.current = undefined;
    }

    function updateRecordPlaybackProgressForRecord(audio: HTMLAudioElement, record: RecordingTakeSummary | undefined) {
        if (record) {
            const range = getRecordPlaybackRangeSeconds(record);
            const progress = range.durationSeconds > 0 ? (audio.currentTime - range.startSeconds) / range.durationSeconds : 0;
            syncRecordPlaybackProgress(progress);
            return;
        }

        const durationSeconds = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
        const progress = durationSeconds > 0 ? audio.currentTime / durationSeconds : 0;
        syncRecordPlaybackProgress(progress);
    }

    function stopRecordPlaybackAtRangeEnd(audio: HTMLAudioElement, record: RecordingTakeSummary | undefined) {
        if (!record || typeof record.audioEndTime !== 'number') return false;

        const range = getRecordPlaybackRangeSeconds(record);
        if (range.durationSeconds <= 0 || audio.currentTime < range.endSeconds) return false;
        if (recordPlaybackRef.current !== audio) return true;

        audio.pause();
        cancelRecordPlaybackFrame();
        recordPlaybackRef.current = null;
        recordPlaybackSeekRef.current = undefined;
        setPlayingRecordKey(undefined);
        setIsRecordPlaybackPaused(false);
        syncRecordPlaybackProgress(1, { syncState: true });
        return true;
    }

    function updateRecordingBufferPreviewProgress(audio: HTMLAudioElement, selectionDurationMs: number) {
        const durationSeconds =
            Number.isFinite(audio.duration) && audio.duration > 0
                ? audio.duration
                : selectionDurationMs > 0
                  ? selectionDurationMs / 1000
                  : 0;
        const progress = durationSeconds > 0 ? audio.currentTime / durationSeconds : 0;
        syncRecordPlaybackProgress(progress);
    }

    function syncRecordPlaybackProgress(progress: number, options?: { syncState?: boolean }) {
        const clampedProgress = Math.min(1, Math.max(0, progress));
        const progressPercent = Math.round(clampedProgress * 10000) / 100;

        recordPlaybackProgressRef.current = clampedProgress;
        waveformRef.current?.style.setProperty('--tr-waveform-progress', `${progressPercent}%`);

        const now = typeof performance === 'undefined' ? Date.now() : performance.now();
        if (options?.syncState || now - recordPlaybackProgressStateSyncedAtRef.current > 250) {
            recordPlaybackProgressStateSyncedAtRef.current = now;
            setRecordPlaybackProgress(clampedProgress);
        }
    }

    function applyPendingRecordPlaybackSeek(audio: HTMLAudioElement, recordKey: string, record: RecordingTakeSummary) {
        const pendingSeek = recordPlaybackSeekRef.current;

        const applySeek = () => {
            audio.currentTime =
                pendingSeek && pendingSeek.recordKey === recordKey
                    ? Math.max(0, pendingSeek.seconds)
                    : getRecordPlaybackRangeSeconds(record).startSeconds;
            recordPlaybackSeekRef.current = undefined;
            updateRecordPlaybackProgressForRecord(audio, record);
        };

        try {
            applySeek();
        } catch {
            audio.addEventListener('loadedmetadata', applySeek, { once: true });
        }
    }

    function seekRecordingBufferPreviewWaveform(event: ReactPointerEvent<HTMLDivElement>) {
        if (!pendingRecordingBuffer) return;

        const audio = recordingBufferPreviewRef.current;
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const durationSeconds = pendingRecordingBuffer.selection.durationMs / 1000;
        if (durationSeconds <= 0) return;

        const nextSeconds = ratio * durationSeconds;
        if (!audio) {
            previewPendingRecordingBuffer(nextSeconds, { autoplay: false });
            return;
        }

        audio.currentTime = nextSeconds;
        audio.pause();
        setIsRecordingBufferPreviewPlaying(false);
        syncRecordPlaybackProgress(ratio, { syncState: true });
        updateRecordingBufferPreviewProgress(audio, pendingRecordingBuffer.selection.durationMs);
    }

    function seekRecordWaveform(event: ReactPointerEvent<HTMLDivElement>) {
        if (event.button !== 0 || isRecording) return;

        if (pendingRecordingBuffer) {
            seekRecordingBufferPreviewWaveform(event);
            return;
        }

        if (!focusedRecord || !activeFocusedRecordKey) return;

        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const range = getRecordPlaybackRangeSeconds(focusedRecord);
        if (range.durationSeconds <= 0) return;

        const nextSeconds = range.startSeconds + ratio * range.durationSeconds;
        const currentAudio = recordPlaybackRef.current;
        recordPlaybackSeekRef.current = { recordKey: activeFocusedRecordKey, seconds: nextSeconds };
        syncRecordPlaybackProgress(ratio, { syncState: true });

        if (currentAudio && playingRecordKey === activeFocusedRecordKey) {
            currentAudio.currentTime = nextSeconds;
            updateRecordPlaybackProgressForRecord(currentAudio, focusedRecord);
            if (!currentAudio.paused && !currentAudio.ended) {
                startRecordPlaybackProgressLoop(currentAudio, focusedRecord);
            }
        }
    }

    function toggleCharacterFilter(characterId: number) {
        setSelectedCharacterIds((current) => {
            const nextSelectedIds = current.includes(characterId)
                ? current.filter((item) => item !== characterId)
                : [...current, characterId];

            return normalizeSelectedCharacterIds({
                selectedCharacterIds: nextSelectedIds,
                availableCharacterIds,
                fallbackToAll: false,
            });
        });
    }

    function toggleAllCharacterFilters() {
        setSelectedCharacterIds((current) => {
            const normalizedCurrent = normalizeSelectedCharacterIds({
                selectedCharacterIds: current,
                availableCharacterIds,
                fallbackToAll: false,
            });

            return normalizedCurrent.length === availableCharacterIds.length ? [] : availableCharacterIds;
        });
    }

    function selectStripCue(cueId: number, characterId: number) {
        stopRecordPlayback();
        setSelectedCharacterIds((current) => (current.includes(characterId) ? current : [...current, characterId]));
        setSelectedCueId(cueId);
    }

    function updateRecordingStripScale(value: string) {
        const scale = Math.round(Number(value));
        if (!Number.isFinite(scale)) return;

        setRecordingStripScale(toRecordingStripSize(scale).scale);
    }

    return (
        <div className="tp-catalog tr-record">
            <header className="tp-topbar tr-record-topbar">
                <Link className="tp-brand" href="/studio/products">
                    <ToonedBrand />
                </Link>
                <nav className="tp-crumb" aria-label="녹음 경로">
                    <Link href="/studio/products">내 작품</Link>
                    <span>/</span>
                    <Link href={`/studio/products/${product.id}/episodes`}>{product.title}</Link>
                    <span>/</span>
                    <strong>
                        {episode.episodeNumber}화 · {episodeTitle} · 녹음
                    </strong>
                </nav>
                <div className="tp-spacer" />
                <label className="tr-artist-select">
                    <span>성우</span>
                    <select onChange={(event) => setSelectedArtistId(event.target.value)} value={selectedArtistId}>
                        {artists.length === 0 ? <option value="">성우 없음</option> : null}
                        {artists.map((artist) => (
                            <option key={artist.id} value={artist.id}>
                                {artist.name}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="tr-progress-pill">
                    <span>선택 대사 녹음 진행률</span>
                    <i>
                        <b style={{ width: `${progress.percent}%` }} />
                    </i>
                    <strong>
                        {progress.done} / {progress.total} 완료
                    </strong>
                </div>
                <Link className="tp-btn ghost tr-top-link" href={`/studio/products/${product.id}/episodes/${episodeId}`}>
                    편집기
                </Link>
            </header>

            <div className="tp-catalog-body tr-record-body">
                <nav className="tp-rail tr-record-rail" aria-label="스튜디오 메뉴">
                    <Link href={`/studio/products/${product.id}/episodes`} title="작품">
                        <StudioCatalogIcon name="asset" />
                        <span>작품</span>
                    </Link>
                    <Link href={`/studio/products/${product.id}/media`} title="구성">
                        <StudioCatalogIcon name="image" />
                        <span>구성</span>
                    </Link>
                    <Link href={`/studio/products/${product.id}/artists`} title="성우">
                        <StudioCatalogIcon name="users" />
                        <span>성우</span>
                    </Link>
                    <Link className="active" href={`/studio/products/${product.id}/episodes/${episodeId}/record`} title="녹음">
                        <StudioCatalogIcon name="mic" />
                        <span>녹음</span>
                    </Link>
                    <Link href={`/studio/products/${product.id}/episodes/${episodeId}`} title="편집기">
                        <StudioCatalogIcon name="panel" />
                        <span>편집기</span>
                    </Link>
                    <span className="tp-rail-spacer" />
                    <Link href="/studio/products" title="설정">
                        <StudioCatalogIcon name="settings" />
                        <span>설정</span>
                    </Link>
                </nav>

                <main className="tr-record-workspace" style={recordWorkspaceStyle}>
                    <aside className="tr-queue-panel">
                        <div className="tr-panel-head">
                            <div>
                                <h2>대사 큐</h2>
                                <p>
                                    {selectedAvailableCharacterIds.length} / {availableCharacters.length} 캐릭터 선택
                                </p>
                            </div>
                            <span>{queue.length}</span>
                        </div>
                        <div className="tr-character-filter" aria-label="캐릭터 필터">
                            <label className={isAllCharactersSelected ? 'active' : ''}>
                                <input
                                    checked={isAllCharactersSelected}
                                    onChange={toggleAllCharacterFilters}
                                    type="checkbox"
                                />
                                <span>전체</span>
                                <em>{allQueue.length}</em>
                            </label>
                            {availableCharacters.map((character) => (
                                <label
                                    className={selectedAvailableCharacterIds.includes(character.id) ? 'active' : ''}
                                    key={character.id}
                                    style={{ borderColor: character.color }}
                                >
                                    <input
                                        checked={selectedAvailableCharacterIds.includes(character.id)}
                                        onChange={() => toggleCharacterFilter(character.id)}
                                        type="checkbox"
                                    />
                                    <span>{character.name}</span>
                                    <em>{cueCountByCharacterId.get(character.id) ?? 0}</em>
                                </label>
                            ))}
                        </div>
                        <div className="tr-filter-tabs" role="tablist" aria-label="대사 상태 필터">
                            {(['all', 'pending', 'done'] as RecordingCueFilter[]).map((status) => (
                                <button
                                    aria-selected={filter === status}
                                    className={filter === status ? 'active' : ''}
                                    key={status}
                                    onClick={() => setFilter(status)}
                                    role="tab"
                                    type="button"
                                >
                                    {filterLabels[status]}
                                    <span>{status === 'all' ? progress.total : status === 'done' ? progress.done : progress.pending}</span>
                                </button>
                            ))}
                        </div>
                        <div className="tr-cue-list">
                            {visibleQueue.length === 0 ? (
                                <div className="tr-empty">{selectedAvailableCharacterIds.length === 0 ? '캐릭터 필터를 선택하세요.' : '대사가 없습니다.'}</div>
                            ) : (
                                visibleQueue.map((item) => (
                                    <button
                                        className={`tr-cue-row ${item.cueId === selectedCue?.cueId ? 'active' : ''} ${item.status}`}
                                        key={item.cueId}
                                        onClick={() => {
                                            stopRecordPlayback();
                                            setSelectedCueId(item.cueId);
                                        }}
                                        style={{ borderColor: item.cueId === selectedCue?.cueId ? item.characterColor : undefined }}
                                        type="button"
                                    >
                                        <span className={`tr-cue-status ${item.characterImageUrl ? 'has-image' : ''}`}>
                                            {item.characterImageUrl ? (
                                                <img alt="" src={item.characterImageUrl} />
                                            ) : (
                                                <StudioCatalogIcon name={item.status === 'done' ? 'check' : 'mic'} />
                                            )}
                                        </span>
                                        <span className="tr-cue-copy">
                                            <strong>{item.text}</strong>
                                            <small>
                                                장면 {item.sortOrder} · 테이크 {item.takeCount}
                                            </small>
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </aside>

                    <section className="tr-strip-panel" aria-label="스트립 위치">
                        <div className="tr-strip-head">
                            <span>스트립</span>
                            <strong>
                                대사 위치 {stripCueMarkers.length}
                            </strong>
                        </div>
                        <div className="tr-strip-controls">
                            <label>
                                <span>크기</span>
                                <input
                                    aria-label="녹음 스트립 크기"
                                    max={200}
                                    min={70}
                                    onChange={(event) => updateRecordingStripScale(event.currentTarget.value)}
                                    step={5}
                                    type="range"
                                    value={recordingStripSize.scale}
                                />
                                <input
                                    aria-label="녹음 스트립 크기 숫자"
                                    max={200}
                                    min={70}
                                    onChange={(event) => updateRecordingStripScale(event.currentTarget.value)}
                                    step={5}
                                    type="number"
                                    value={recordingStripSize.scale}
                                />
                            </label>
                            <small>
                                폭 {recordingStripSize.width}px · 패널 {recordingStripSize.panelWidth}px · 원본 비율
                            </small>
                        </div>
                        <div className="tr-strip">
                            <div className="tr-strip-map">
                                {stripClips.map((clip, index) => {
                                    const clipMarkers =
                                        typeof clip.canvasMediaId === 'number'
                                            ? stripCueMarkersByCanvasMediaId.get(clip.canvasMediaId) ?? []
                                            : [];
                                    const isSelectedClip =
                                        typeof selectedCueMarker?.canvasMediaId === 'number' &&
                                        selectedCueMarker.canvasMediaId === clip.canvasMediaId;

                                    return (
                                        <div
                                            className={`tr-strip-clip ${clip.mediaUrl ? 'has-media' : 'is-placeholder'} ${isSelectedClip ? 'active' : ''}`}
                                            key={clip.id}
                                            style={getStripClipStyle(clip)}
                                        >
                                            <RecordStripPreview clip={clip} />
                                            <b>{index + 1}</b>
                                            <span>{clip.label}</span>
                                            {clipMarkers.map((marker) => (
                                                <button
                                                    className={`tr-strip-cue-marker ${marker.isSelected ? 'active' : ''} ${marker.status}`}
                                                    key={marker.cueId}
                                                    onClick={() => selectStripCue(marker.cueId, marker.characterId)}
                                                    style={{
                                                        borderColor: marker.characterColor,
                                                        top: `${marker.positionPercent}%`,
                                                    }}
                                                    type="button"
                                                >
                                                    <i style={{ background: marker.characterColor }} />
                                                    <span>{marker.characterName}</span>
                                                    <strong>{marker.text}</strong>
                                                    <em>{formatMs(marker.startTime)}</em>
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })}
                                {unplacedStripCueMarkers.length > 0 ? (
                                    <div className="tr-strip-cue-layer" aria-label="대사 등록 위치 미지정">
                                        {unplacedStripCueMarkers.map((marker) => (
                                            <button
                                                className={`tr-strip-cue-marker ${marker.isSelected ? 'active' : ''} ${marker.status}`}
                                                key={marker.cueId}
                                                onClick={() => selectStripCue(marker.cueId, marker.characterId)}
                                                style={{ borderColor: marker.characterColor, top: `${marker.topPercent}%` }}
                                                type="button"
                                            >
                                                <i style={{ background: marker.characterColor }} />
                                                <span>{marker.characterName}</span>
                                                <strong>{marker.text}</strong>
                                                <em>{formatMs(marker.startTime)}</em>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </section>

                    <section className="tr-read-panel">
                        <div className="tr-read-content">
                            {selectedCue ? (
                                <div className="tr-cue-stage">
                                    <div className="tr-cue-caption">
                                        <span className="tr-character-pill" style={{ borderColor: selectedCue.characterColor, color: selectedCue.characterColor }}>
                                            {selectedCue.characterName}
                                        </span>
                                        <h1>{selectedCue.text}</h1>
                                        <p>{selectedCue.trackName}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="tr-empty large">녹음할 대사가 없습니다.</div>
                            )}
                        </div>

                        <div className="tr-record-console">
                            <div
                                aria-label="녹음 재생 위치"
                                aria-valuemax={100}
                                aria-valuemin={0}
                                aria-valuenow={Math.round(waveformProgressPercent)}
                                className={`tr-waveform ${isWaveformLoading ? 'loading' : ''}`}
                                onPointerDown={seekRecordWaveform}
                                ref={waveformRef}
                                role="slider"
                                style={waveformStyle}
                                tabIndex={focusedRecord && !isRecording && !pendingRecordingBuffer ? 0 : -1}
                            >
                                {hasRecordWaveform ? (
                                    <>
                                        <div className="tr-waveform-bars">
                                            {currentWave.map((height, index) => (
                                                <i key={index} style={{ height: `${height}%` }} />
                                            ))}
                                        </div>
                                        {!isRecording ? (
                                            <div aria-hidden="true" className="tr-waveform-progress">
                                                {currentWave.map((height, index) => (
                                                    <i key={index} style={{ height: `${height}%` }} />
                                                ))}
                                            </div>
                                        ) : null}
                                        <span className="tr-waveform-time">{formatDurationSeconds(waveformDurationMs)}</span>
                                    </>
                                ) : (
                                    <div className="tr-waveform-empty">녹음 파일 없음</div>
                                )}
                            </div>
                            <div className="tr-transport">
                                <button
                                    aria-label={isTransportPlaybackActive ? '일시정지' : '재생'}
                                    disabled={!(pendingRecordingBuffer || focusedRecord) || isRecording}
                                    onClick={toggleTransportPlayback}
                                    type="button"
                                >
                                    <StudioCatalogIcon name={isTransportPlaybackActive ? 'pause' : 'play'} />
                                    <span>{isTransportPlaybackActive ? '일시정지' : '재생'}</span>
                                </button>
                                <button
                                    aria-label="정지"
                                    disabled={!isRecording && !playingRecordKey && !isRecordingBufferPreviewPlaying}
                                    onClick={stopTransport}
                                    type="button"
                                >
                                    <StudioCatalogIcon name="stop" />
                                    <span>정지</span>
                                </button>
                                <button
                                    aria-label="녹음"
                                    className={`tr-record-action ${isRecording ? 'recording' : ''}`}
                                    disabled={!selectedCue || isSavingRecord || isRecording || recordingBufferStatus === 'starting'}
                                    onClick={() => void startRecording()}
                                    type="button"
                                >
                                    <StudioCatalogIcon name="mic" />
                                    <span>{isSavingRecord ? '저장 중' : pendingRecordingBuffer ? '다시 녹음' : '녹음'}</span>
                                </button>
                                <button
                                    aria-label="외부 녹음 파일 가져오기"
                                    className="tr-import-record-action"
                                    disabled={!selectedCue || isSavingRecord || isRecording}
                                    onClick={openExternalRecordPicker}
                                    type="button"
                                >
                                    <StudioCatalogIcon name="download" />
                                    <span>파일 가져오기</span>
                                </button>
                                <input
                                    accept={EXTERNAL_RECORD_ACCEPT}
                                    className="tr-external-record-input"
                                    onChange={handleExternalRecordFileChange}
                                    ref={externalRecordInputRef}
                                    type="file"
                                />
                            </div>
                            {pendingRecordingBuffer ? (
                                <div className="tr-record-buffer">
                                    <div className="tr-record-buffer-head">
                                        <div>
                                            <h3>녹음 버퍼</h3>
                                            <p>최근 30초에서 사용할 구간을 끌어서 지정</p>
                                        </div>
                                        <span>
                                            사용 {formatDurationSeconds(pendingRecordingBuffer.selection.durationMs)} · 버퍼{' '}
                                            {formatDurationSeconds(pendingRecordingBuffer.bufferDurationMs)}
                                        </span>
                                    </div>
                                    <div
                                        className="tr-record-buffer-wave"
                                        onPointerDown={placePendingRecordingBufferSelection}
                                        ref={recordingBufferTrimRef}
                                    >
                                        <div
                                            className="tr-record-buffer-bars"
                                            style={{ '--tr-waveform-bar-count': pendingRecordingBuffer.wave.length } as CSSProperties}
                                        >
                                            {pendingRecordingBuffer.wave.map((height, index) => {
                                                const barTimeMs =
                                                    pendingRecordingBuffer.wave.length > 1
                                                        ? (index / (pendingRecordingBuffer.wave.length - 1)) *
                                                          pendingRecordingBuffer.bufferDurationMs
                                                        : 0;
                                                const isSelected =
                                                    barTimeMs >= pendingRecordingBuffer.selection.startMs &&
                                                    barTimeMs <= pendingRecordingBuffer.selection.endMs;

                                                return (
                                                    <i
                                                        className={isSelected ? 'selected' : ''}
                                                        key={index}
                                                        style={{ height: `${height}%` }}
                                                    />
                                                );
                                            })}
                                        </div>
                                        {pendingRecordingBufferWindow ? (
                                            <div
                                                className="tr-record-buffer-window"
                                                onPointerDown={startPendingRecordingBufferSelectionDrag}
                                                style={{
                                                    left: `${pendingRecordingBufferWindow.leftPercent}%`,
                                                    width: `${pendingRecordingBufferWindow.widthPercent}%`,
                                                }}
                                            />
                                        ) : null}
                                    </div>
                                    <div className="tr-record-buffer-actions">
                                        <button disabled={isSavingRecord} onClick={() => void savePendingRecordingBuffer()} type="button">
                                            선택 구간 저장
                                        </button>
                                        <button
                                            disabled={isSavingRecord}
                                            onClick={() => {
                                                stopRecordingBufferPreview();
                                                setPendingRecordingBuffer(undefined);
                                                setMessage('');
                                            }}
                                            type="button"
                                        >
                                            취소
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className={`tr-record-buffer-status ${recordingBufferStatus}`}>
                                    <span>버퍼</span>
                                    <strong>{recordingBufferStatus === 'ready' ? formatDurationSeconds(recordingBufferMs) : '준비 중'}</strong>
                                    <em>최대 {formatDurationSeconds(recordingCircularBufferMaxMs)}</em>
                                </div>
                            )}
                            {message ? <p className="tr-record-message">{message}</p> : null}
                        </div>
                    </section>

                    <aside className="tr-take-panel">
                        <div className="tr-panel-head">
                            <div>
                                <h2>레코드 목록</h2>
                                <p>{selectedCue ? `${selectedRecords.length}개` : '0개'}</p>
                            </div>
                        </div>
                        <div className="tr-take-list">
                            {selectedRecords.map((record, index) => {
                                const recordApiId = getMutableRecordApiId(record);
                                const recordKey = getRecordingTakeKey(record);

                                return (
                                    <article
                                        className={`tr-take-card ${record.isAccepted ? 'accepted' : ''} ${recordKey === activeFocusedRecordKey ? 'is-focused' : ''}`}
                                        key={recordKey}
                                        onClick={() => {
                                            stopRecordPlayback();
                                            setFocusedRecordKey(recordKey);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key !== 'Enter' && event.key !== ' ') return;

                                            event.preventDefault();
                                            stopRecordPlayback();
                                            setFocusedRecordKey(recordKey);
                                        }}
                                        role="button"
                                        tabIndex={0}
                                    >
                                            <button
                                                disabled={!record.audioUrl}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    toggleRecordPlayback(record);
                                            }}
                                            type="button"
                                        >
                                            <StudioCatalogIcon name={playingRecordKey === recordKey && !isRecordPlaybackPaused ? 'pause' : 'play'} />
                                        </button>
                                        <div>
                                            <strong>테이크 {index + 1}</strong>
                                            <small>
                                                서버 기록 · {formatDurationSeconds(getRecordDisplayDurationMs(record))}
                                            </small>
                                        </div>
                                        <button
                                            disabled={!recordApiId || record.isAccepted || isSavingRecord}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void acceptRecord(record);
                                            }}
                                            type="button"
                                        >
                                            {record.isAccepted ? '채택' : '채택하기'}
                                        </button>
                                        <button
                                            aria-label="테이크 삭제"
                                            disabled={!recordApiId || isSavingRecord}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void deleteRecord(record);
                                            }}
                                            type="button"
                                        >
                                            <StudioCatalogIcon name="trash" />
                                        </button>
                                    </article>
                                );
                            })}
                            {selectedRecords.length === 0 ? <div className="tr-empty">아직 테이크가 없습니다.</div> : null}
                        </div>
                    </aside>
                </main>
            </div>
        </div>
    );
}

function getRecordStripClips({ draft, manifest }: { draft: PlayerDraft; manifest: PlayerManifest }): VisualClip[] {
    const canvasClips = toVisualClips(manifest.canvases ?? []);
    if (canvasClips.length > 0) return canvasClips;

    return draft.media
        .filter((media) => media.kind === 'image' || media.kind === 'video')
        .map((media, index) => {
            const mediaType = media.kind === 'video' ? 'video' : 'image';

            return {
                id: String(media.id),
                mediaId: media.id,
                kind: mediaType === 'video' ? 'video' : 'cut',
                start: index,
                duration: 1,
                label: mediaType === 'video' ? `영상 ${index + 1}` : `컷 ${index + 1}`,
                description: media.url,
                background: 'linear-gradient(160deg,#22304f,#111827 62%,#263c2f)',
                mediaUrl: media.url,
                mediaType,
            };
        });
}

async function requestRecordingUploadUrl(apiBaseUrl: string, request: { key: string; contentType: string }) {
    const response = await fetch(`${apiBaseUrl}/files/uploadUrls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [request] }),
    });

    if (!response.ok) {
        throw new Error(`Upload URL request failed: ${response.status}`);
    }

    const payload = (await response.json()) as UploadUrlsResponse;
    const uploadUrl = payload.data?.[0];

    if (!uploadUrl) {
        throw new Error('Upload URL response is empty');
    }

    return uploadUrl;
}

async function buildRecordWaveformPeaks(
    audioUrl: string,
    barCount: number,
    range?: { startMs: number; endMs?: number },
): Promise<number[]> {
    const response = await fetch(audioUrl, { cache: 'force-cache' });
    if (!response.ok) {
        throw new Error(`Waveform audio request failed: ${response.status}`);
    }

    const AudioContextConstructor =
        window.AudioContext ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
        throw new Error('AudioContext is not available');
    }

    const audioContext = new AudioContextConstructor();
    try {
        const audioBuffer = await audioContext.decodeAudioData(await response.arrayBuffer());
        const safeBarCount = Math.max(1, Math.round(barCount));
        const startSample = Math.max(0, Math.floor((range?.startMs ?? 0) / 1000 * audioBuffer.sampleRate));
        const endSample = Math.min(audioBuffer.length, Math.ceil((range?.endMs ?? audioBuffer.duration * 1000) / 1000 * audioBuffer.sampleRate));
        const scopedSampleCount = Math.max(1, endSample - startSample);
        const samplesPerBar = Math.max(1, Math.floor(scopedSampleCount / safeBarCount));
        const rawPeaks = Array.from({ length: safeBarCount }, (_, barIndex) => {
            const start = startSample + barIndex * samplesPerBar;
            const end = barIndex === safeBarCount - 1 ? endSample : Math.min(endSample, start + samplesPerBar);
            let sumSquares = 0;
            let sampleCount = 0;

            for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
                const channelData = audioBuffer.getChannelData(channelIndex);
                for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
                    const sample = channelData[sampleIndex] ?? 0;
                    sumSquares += sample * sample;
                    sampleCount += 1;
                }
            }

            return sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
        });
        const maxPeak = Math.max(...rawPeaks, 0.001);

        return rawPeaks.map((peak) => Math.round(Math.min(96, Math.max(10, 10 + (peak / maxPeak) * 86))));
    } finally {
        void audioContext.close().catch(() => undefined);
    }
}

function getStripClipStyle(clip: VisualClip): CSSProperties {
    return {
        background: clip.background,
    };
}

function RecordStripPreview({ clip }: { clip: VisualClip }) {
    if (!clip.mediaUrl) return null;

    if (clip.mediaType === 'video') {
        return <video muted playsInline preload="metadata" src={clip.mediaUrl} />;
    }

    return <img alt="" src={clip.mediaUrl} />;
}

function normalizeSelectedCharacterIds({
    selectedCharacterIds,
    availableCharacterIds,
    fallbackToAll,
}: {
    selectedCharacterIds: number[];
    availableCharacterIds: number[];
    fallbackToAll: boolean;
}) {
    const availableCharacterIdSet = new Set(availableCharacterIds);
    const normalizedIds = selectedCharacterIds.filter(
        (characterId, index, ids) => availableCharacterIdSet.has(characterId) && ids.indexOf(characterId) === index,
    );

    return normalizedIds.length > 0 || !fallbackToAll ? normalizedIds : availableCharacterIds;
}

function getClientApiBaseUrl(): string {
    return (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4100').replace(/\/$/, '');
}

function getMutableRecordApiId(record: RecordingTakeSummary): number | undefined {
    if (record.id < 0) return undefined;
    return getRecordApiId(record.id);
}

async function updateCueAudioRange({
    apiBaseUrl,
    trackId,
    cueId,
    audioId,
    audioStartTime,
    audioEndTime,
}: {
    apiBaseUrl: string;
    trackId: number;
    cueId: number;
    audioId: number;
    audioStartTime: number;
    audioEndTime: number;
}) {
    const response = await fetch(`${apiBaseUrl}/tracks/${trackId}/cues/${cueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioId, audioStartTime, audioEndTime }),
    });

    if (!response.ok) {
        throw new Error(`Cue audio range update failed: ${response.status}`);
    }
}

function getAudioContextConstructor(): typeof AudioContext | undefined {
    if (typeof window === 'undefined') return undefined;

    return window.AudioContext ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function getRecordingTakeKey(record: RecordingTakeSummary): string {
    return `${record.source}-${record.id}`;
}

function getLatestRecordingTake(records: RecordingTakeSummary[]): RecordingTakeSummary | undefined {
    return records.reduce<RecordingTakeSummary | undefined>((latestRecord, record) => {
        if (!latestRecord) return record;

        const recordId = getMutableRecordApiId(record) ?? record.id;
        const latestRecordId = getMutableRecordApiId(latestRecord) ?? latestRecord.id;
        return recordId >= latestRecordId ? record : latestRecord;
    }, undefined);
}

function getRecordDisplayDurationMs(record: RecordingTakeSummary): number {
    return getRecordPlaybackRangeMs(record).durationMs;
}

function getRecordPlaybackRangeMs(record: RecordingTakeSummary): { startMs: number; endMs?: number; durationMs: number } {
    const startMs =
        typeof record.audioStartTime === 'number' && Number.isFinite(record.audioStartTime)
            ? Math.max(0, Math.round(record.audioStartTime))
            : 0;
    const endMs =
        typeof record.audioEndTime === 'number' && Number.isFinite(record.audioEndTime) && record.audioEndTime > startMs
            ? Math.round(record.audioEndTime)
            : undefined;
    const sourceDurationMs = typeof record.durationMs === 'number' && record.durationMs > 0 ? Math.round(record.durationMs) : 0;
    const durationMs = typeof endMs === 'number' ? Math.max(0, endMs - startMs) : sourceDurationMs;

    return { startMs, endMs, durationMs };
}

function getRecordPlaybackRangeSeconds(record: RecordingTakeSummary) {
    const range = getRecordPlaybackRangeMs(record);
    const startSeconds = range.startMs / 1000;
    const durationSeconds = range.durationMs / 1000;
    const endSeconds = typeof range.endMs === 'number' ? range.endMs / 1000 : startSeconds + durationSeconds;

    return { startSeconds, endSeconds, durationSeconds };
}

function getExternalRecordContentType(file: File): string {
    if (file.type.trim()) return file.type.trim();

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'mp3') return 'audio/mpeg';
    if (extension === 'm4a' || extension === 'mp4') return 'audio/mp4';
    if (extension === 'wav') return 'audio/wav';
    if (extension === 'ogg') return 'audio/ogg';

    return 'audio/webm';
}

function stopRecordingStream(stream: MediaStream | null) {
    stream?.getTracks().forEach((track) => track.stop());
}

function toRecordErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return `${fallback} (${error.message})`;
    }

    return fallback;
}

function formatMs(milliseconds: number): string {
    const safeMs = Math.max(0, milliseconds);
    const totalSeconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((safeMs % 1000) / 100);

    return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function formatDurationSeconds(milliseconds: number): string {
    const seconds = Math.max(0, milliseconds) / 1000;
    const fractionDigits = seconds < 10 ? 3 : 1;
    const formattedSeconds = seconds
        .toFixed(fractionDigits)
        .replace(/(\.\d*?)0+$/, '$1')
        .replace(/\.$/, '');

    return `${formattedSeconds}초`;
}

function createWave(seed: string | number | undefined, count: number): number[] {
    const numericSeed =
        typeof seed === 'number'
            ? seed
            : (seed ?? 'missing-record-audio')
                  .split('')
                  .reduce((sum, character, index) => sum + character.charCodeAt(0) * (index + 1), 0);

    return Array.from({ length: count }, (_, index) => {
        const phase = numericSeed * 0.017 + index * 0.72;
        const height = 34 + Math.abs(Math.sin(phase)) * 42 + Math.abs(Math.cos(phase * 0.41)) * 18;
        return Math.round(Math.min(92, Math.max(14, height)));
    });
}
