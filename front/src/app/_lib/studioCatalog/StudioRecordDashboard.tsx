'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ToonedBrand } from '../brand/ToonedBrand';
import { uploadFileToPresignedUrl } from '../player/mediaUploadBatch';
import type { StudioEpisodeDetails } from '../player/getEpisodeDetails';
import { getPlayerDraft } from '../player/getPlayerDraft';
import { getPlayerManifest } from '../player/getPlayerManifest';
import type { PlayerDraft } from '../player/playerDraft.types';
import type { PlayerManifest } from '../player/playerManifest.types';
import { buildRecordCreateRequest, buildRecordingUploadFileRequest, getRecordApiId } from '../player/recordingStudioApi';
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

type ArtistListResponse = {
    data?: {
        items?: StudioRecordArtist[];
    };
};

type UploadUrlsResponse = {
    data?: Array<{
        publicUrl: string;
        mimetype?: string;
        presignedUrl: string;
    }>;
};

const filterLabels: Record<RecordingCueFilter, string> = {
    all: '전체',
    pending: '대기',
    done: '완료',
};

const RECORDING_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'];

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
    const [artists, setArtists] = useState<StudioRecordArtist[]>([]);
    const [filter, setFilter] = useState<RecordingCueFilter>('all');
    const [selectedCueId, setSelectedCueId] = useState<number | undefined>();
    const [recordingStripScale, setRecordingStripScale] = useState(100);
    const [isRecording, setIsRecording] = useState(false);
    const [isSavingRecord, setIsSavingRecord] = useState(false);
    const [recordingStartedAt, setRecordingStartedAt] = useState<number | undefined>();
    const [recordingMs, setRecordingMs] = useState(0);
    const [liveWave, setLiveWave] = useState(() => createWave('idle', 42));
    const [note, setNote] = useState('');
    const [message, setMessage] = useState('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingChunksRef = useRef<Blob[]>([]);
    const recordingStreamRef = useRef<MediaStream | null>(null);
    const recordingCueRef = useRef<RecordingCueQueueItem | undefined>(undefined);
    const recordingArtistIdRef = useRef<string | undefined>(undefined);
    const recordingStartedAtRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        setDraftState(draft);
    }, [draft]);

    useEffect(() => {
        setManifestState(manifest);
    }, [manifest]);

    useEffect(() => {
        let isMounted = true;

        async function loadArtists() {
            try {
                const response = await fetch(`${apiBaseUrl}/artists`, { cache: 'no-store' });
                if (!response.ok) throw new Error(`Artist request failed: ${response.status}`);

                const payload = (await response.json()) as ArtistListResponse;
                const nextArtists = payload.data?.items ?? [];
                if (!isMounted) return;

                setArtists(nextArtists);
                setSelectedArtistId((current) => current || String(nextArtists[0]?.id ?? ''));

                if (nextArtists.length === 0) {
                    setMessage('등록된 성우가 없습니다. 성우 등록 화면에서 먼저 성우를 추가하세요.');
                }
            } catch (error) {
                if (!isMounted) return;
                setMessage(toRecordErrorMessage(error, '성우 목록을 불러오지 못했습니다.'));
            }
        }

        void loadArtists();

        return () => {
            isMounted = false;
        };
    }, [apiBaseUrl]);

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
    const currentWave = isRecording ? liveWave : createWave(selectedCue?.latestRecordUrl ?? selectedCue?.cueId ?? 'empty', 42);
    const totalApiDuration = allQueue
        .flatMap((item) => item.records)
        .reduce((sum, record) => sum + (record.durationMs ?? 0), 0);

    useEffect(() => {
        if (!selectedCue || selectedCue.cueId === selectedCueId) return;
        setSelectedCueId(selectedCue.cueId);
    }, [selectedCue, selectedCueId]);

    useEffect(() => {
        if (!isRecording || typeof recordingStartedAt !== 'number') return;

        const intervalId = window.setInterval(() => {
            const elapsedMs = Date.now() - recordingStartedAt;
            setRecordingMs(elapsedMs);
            setLiveWave(createWave(elapsedMs, 42));
        }, 120);

        return () => window.clearInterval(intervalId);
    }, [isRecording, recordingStartedAt]);

    useEffect(() => {
        return () => {
            const recorder = mediaRecorderRef.current;
            if (recorder) {
                recorder.ondataavailable = null;
                recorder.onstop = null;
                if (recorder.state !== 'inactive') {
                    recorder.stop();
                }
            }
            stopRecordingStream(recordingStreamRef.current);
        };
    }, []);

    async function refreshRecordingData() {
        const [nextDraft, nextManifest] = await Promise.all([
            getPlayerDraft({ productId, episodeId }),
            getPlayerManifest(episodeId),
        ]);

        setDraftState(nextDraft);
        setManifestState(nextManifest);
    }

    async function toggleRecording() {
        if (isRecording) {
            stopRecording();
            return;
        }

        await startRecording();
    }

    async function startRecording() {
        if (!selectedCue) return;

        if (!selectedArtistId) {
            setMessage('녹음할 성우를 먼저 선택하세요.');
            return;
        }

        if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            setMessage('현재 브라우저가 녹음을 지원하지 않습니다.');
            return;
        }

        try {
            setMessage('');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = getSupportedRecordingMimeType();
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            const startedAt = Date.now();

            mediaRecorderRef.current = recorder;
            recordingStreamRef.current = stream;
            recordingChunksRef.current = [];
            recordingCueRef.current = selectedCue;
            recordingArtistIdRef.current = selectedArtistId;
            recordingStartedAtRef.current = startedAt;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordingChunksRef.current.push(event.data);
                }
            };
            recorder.onstop = () => {
                void saveRecordedChunks(recorder.mimeType || mimeType || 'audio/webm');
            };
            recorder.onerror = () => {
                setMessage('녹음 중 오류가 발생했습니다.');
                setIsRecording(false);
                setRecordingStartedAt(undefined);
                stopRecordingStream(recordingStreamRef.current);
            };

            recorder.start();
            setRecordingStartedAt(startedAt);
            setRecordingMs(0);
            setLiveWave(createWave(startedAt, 42));
            setIsRecording(true);
        } catch (error) {
            stopRecordingStream(recordingStreamRef.current);
            setMessage(toRecordErrorMessage(error, '마이크 권한을 확인할 수 없습니다.'));
        }
    }

    function stopRecording() {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === 'inactive') {
            setIsRecording(false);
            setRecordingStartedAt(undefined);
            return;
        }

        recorder.stop();
    }

    async function saveRecordedChunks(contentType: string) {
        const chunks = recordingChunksRef.current;
        const cue = recordingCueRef.current;
        const artistId = recordingArtistIdRef.current;
        const durationMs = Math.max(800, Date.now() - (recordingStartedAtRef.current ?? Date.now()));

        setIsRecording(false);
        setRecordingStartedAt(undefined);
        setRecordingMs(0);

        try {
            if (!cue || !artistId || chunks.length === 0) return;

            setIsSavingRecord(true);
            const uploadRequest = buildRecordingUploadFileRequest({
                productId,
                episodeId,
                cueId: cue.cueId,
                recordedAtMs: Date.now(),
                contentType,
            });
            const recordBlob = new Blob(chunks, { type: uploadRequest.contentType });
            const uploadUrl = await requestRecordingUploadUrl(apiBaseUrl, uploadRequest);

            await uploadFileToPresignedUrl(uploadUrl.presignedUrl, recordBlob, uploadUrl.mimetype || uploadRequest.contentType);

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

            await refreshRecordingData();
            setSelectedCueId(cue.cueId);
            setMessage('녹음이 서버에 저장되었습니다.');
        } catch (error) {
            setMessage(toRecordErrorMessage(error, '녹음 저장에 실패했습니다.'));
        } finally {
            mediaRecorderRef.current = null;
            recordingChunksRef.current = [];
            recordingCueRef.current = undefined;
            recordingArtistIdRef.current = undefined;
            recordingStartedAtRef.current = undefined;
            setIsSavingRecord(false);
            stopRecordingStream(recordingStreamRef.current);
            recordingStreamRef.current = null;
        }
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

            await refreshRecordingData();
            setMessage('테이크를 삭제했습니다.');
        } catch (error) {
            setMessage(toRecordErrorMessage(error, '테이크 삭제에 실패했습니다.'));
        } finally {
            setIsSavingRecord(false);
        }
    }

    function playRecord(audioUrl: string) {
        const audio = new Audio(audioUrl);
        void audio.play().catch((error: unknown) => {
            setMessage(toRecordErrorMessage(error, '테이크를 재생하지 못했습니다.'));
        });
    }

    function selectAdjacentCue(direction: -1 | 1) {
        if (queue.length === 0) return;
        const currentIndex = selectedCue ? queue.findIndex((item) => item.cueId === selectedCue.cueId) : 0;
        const nextIndex = Math.min(queue.length - 1, Math.max(0, currentIndex + direction));
        setSelectedCueId(queue[nextIndex].cueId);
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
                                        onClick={() => setSelectedCueId(item.cueId)}
                                        style={{ borderColor: item.cueId === selectedCue?.cueId ? item.characterColor : undefined }}
                                        type="button"
                                    >
                                        <span className="tr-cue-status">
                                            <StudioCatalogIcon name={item.status === 'done' ? 'check' : 'mic'} />
                                        </span>
                                        <span className="tr-cue-copy">
                                            <strong>{item.text}</strong>
                                            <small>
                                                장면 {item.sortOrder} · 테이크 {item.takeCount}
                                            </small>
                                        </span>
                                        <em>{formatMs(item.startTime)}</em>
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
                                <>
                                    <span className="tr-character-pill" style={{ borderColor: selectedCue.characterColor, color: selectedCue.characterColor }}>
                                        {selectedCue.characterName}
                                    </span>
                                    <h1>{selectedCue.text}</h1>
                                    <p>
                                        {selectedCue.trackName} · {formatMs(selectedCue.startTime)} - {formatMs(selectedCue.endTime)}
                                    </p>
                                    <label className="tr-note-field">
                                        <StudioCatalogIcon name="settings" />
                                        <input
                                            onChange={(event) => setNote(event.target.value)}
                                            placeholder="감정·톤·속도 메모"
                                            value={note}
                                        />
                                    </label>
                                </>
                            ) : (
                                <div className="tr-empty large">녹음할 대사가 없습니다.</div>
                            )}
                        </div>

                        <div className="tr-record-console">
                            <div className="tr-waveform" aria-label="파형">
                                {currentWave.map((height, index) => (
                                    <i key={index} style={{ height: `${height}%` }} />
                                ))}
                                <span>{isRecording ? formatMs(recordingMs) : formatMs(selectedCue?.durationMs ?? 0)}</span>
                            </div>
                            <div className="tr-transport">
                                <button aria-label="이전 대사" onClick={() => selectAdjacentCue(-1)} type="button">
                                    <StudioCatalogIcon name="chevronLeft" />
                                </button>
                                <button aria-label="다음 대사" onClick={() => selectAdjacentCue(1)} type="button">
                                    <StudioCatalogIcon name="chevronRight" />
                                </button>
                                <button
                                    aria-label={isRecording ? '녹음 정지' : '녹음 시작'}
                                    className={`tr-record-main ${isRecording ? 'recording' : ''}`}
                                    disabled={!selectedCue || !selectedArtistId || isSavingRecord}
                                    onClick={() => void toggleRecording()}
                                    type="button"
                                >
                                    <span />
                                </button>
                                <button disabled={!selectedCue || !selectedArtistId || isSavingRecord} onClick={() => void toggleRecording()} type="button">
                                    {isRecording ? '정지' : isSavingRecord ? '저장' : '녹음'}
                                </button>
                            </div>
                            {message ? <p className="tr-record-message">{message}</p> : null}
                        </div>
                    </section>

                    <aside className="tr-take-panel">
                        <div className="tr-panel-head">
                            <div>
                                <h2>테이크</h2>
                                <p>{selectedCue ? `${selectedRecords.length}개` : '0개'}</p>
                            </div>
                        </div>
                        <div className="tr-take-list">
                            {selectedRecords.map((record, index) => {
                                const recordApiId = getMutableRecordApiId(record);

                                return (
                                    <article className={`tr-take-card ${record.isAccepted ? 'accepted' : ''}`} key={`${record.source}-${record.id}`}>
                                        <button onClick={() => playRecord(record.audioUrl)} type="button">
                                            <StudioCatalogIcon name="play" />
                                        </button>
                                        <div>
                                            <strong>테이크 {index + 1}</strong>
                                            <small>
                                                서버 기록 · {formatMs(record.durationMs ?? 0)}
                                            </small>
                                        </div>
                                        <button
                                            disabled={!recordApiId || record.isAccepted || isSavingRecord}
                                            onClick={() => void acceptRecord(record)}
                                            type="button"
                                        >
                                            {record.isAccepted ? '채택' : '채택하기'}
                                        </button>
                                        <button
                                            aria-label="테이크 삭제"
                                            disabled={!recordApiId || isSavingRecord}
                                            onClick={() => void deleteRecord(record)}
                                            type="button"
                                        >
                                            <StudioCatalogIcon name="trash" />
                                        </button>
                                    </article>
                                );
                            })}
                            {selectedRecords.length === 0 ? <div className="tr-empty">아직 테이크가 없습니다.</div> : null}
                        </div>
                        <dl className="tr-record-stats">
                            <div>
                                <dt>완료 대사</dt>
                                <dd>
                                    {progress.done}
                                    <small> / {progress.total}</small>
                                </dd>
                            </div>
                            <div>
                                <dt>총 녹음 길이</dt>
                                <dd>{formatMs(totalApiDuration)}</dd>
                            </div>
                        </dl>
                        <Link className="tp-btn primary tr-export" href={`/studio/products/${product.id}/episodes/${episodeId}`}>
                            완료본 편집기로 전달
                        </Link>
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

function getSupportedRecordingMimeType(): string {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return '';
    }

    return RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
}

function getMutableRecordApiId(record: RecordingTakeSummary): number | undefined {
    if (record.id < 0) return undefined;
    return getRecordApiId(record.id);
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

function createWave(seed: string | number, count: number): number[] {
    const numericSeed =
        typeof seed === 'number'
            ? seed
            : seed.split('').reduce((sum, character, index) => sum + character.charCodeAt(0) * (index + 1), 0);

    return Array.from({ length: count }, (_, index) => {
        const phase = numericSeed * 0.017 + index * 0.72;
        const height = 34 + Math.abs(Math.sin(phase)) * 42 + Math.abs(Math.cos(phase * 0.41)) * 18;
        return Math.round(Math.min(92, Math.max(14, height)));
    });
}
