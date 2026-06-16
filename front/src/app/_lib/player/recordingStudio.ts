import type { PlayerDraft } from './playerDraft.types';
import type { CueManifest, PlayerManifest, RecordManifest } from './playerManifest.types';

export type RecordingCueFilter = 'all' | 'pending' | 'done';
export type RecordingCueStatus = 'pending' | 'done';

export interface RecordingTakeSummary {
    id: number;
    cueId: number;
    audioUrl: string;
    durationMs?: number;
    volume: number;
    isAccepted: boolean;
    source: 'draft' | 'manifest';
}

export interface RecordingCueQueueItem {
    id: number;
    cueId: number;
    scriptId: number;
    characterId: number;
    characterName: string;
    characterColor: string;
    trackId: number;
    trackName: string;
    text: string;
    sortOrder: number;
    startTime: number;
    endTime: number;
    durationMs: number;
    startCanvasMediaId?: number;
    endCanvasMediaId?: number;
    startPosition?: number;
    endPosition?: number;
    status: RecordingCueStatus;
    takeCount: number;
    latestRecordUrl?: string;
    ttsUrl?: string;
    records: RecordingTakeSummary[];
}

export interface RecordingProgress {
    total: number;
    done: number;
    pending: number;
    percent: number;
}

export interface RecordingCueStripMarker {
    cueId: number;
    characterId: number;
    characterName: string;
    characterColor: string;
    text: string;
    startTime: number;
    canvasMediaId?: number;
    positionPercent: number;
    topPercent: number;
    status: RecordingCueStatus;
    isSelected: boolean;
}

type DraftCue = PlayerDraft['cues'][number];
type DraftRecord = PlayerDraft['records'][number];
type RecordingTrackSource = PlayerDraft['tracks'][number] | PlayerManifest['tracks'][number];
type RecordingCueSource = DraftCue | CueManifest;

const defaultRecordingStripWidth = 320;
const defaultRecordingStripFallbackHeight = 164;

export function buildRecordingCueQueue({
    draft,
    manifest,
    characterId,
}: {
    draft: PlayerDraft;
    manifest?: PlayerManifest;
    characterId?: number;
}): RecordingCueQueueItem[] {
    const scriptsById = new Map(draft.scripts.map((script) => [script.id, script]));
    const charactersById = new Map(draft.characters.map((character) => [character.id, character]));
    const tracksById = new Map<number, RecordingTrackSource>();
    const manifestCuesById = new Map((manifest?.cues ?? []).map((cue) => [cue.id, cue]));
    const cuesById = new Map<number, RecordingCueSource>();
    const recordsByCueId = new Map<number, RecordingTakeSummary[]>();

    for (const track of manifest?.tracks ?? []) {
        tracksById.set(track.id, track);
    }

    for (const track of draft.tracks) {
        tracksById.set(track.id, track);
    }

    for (const cue of draft.cues) {
        if (tracksById.get(cue.trackId)?.kind !== 'record') continue;
        cuesById.set(cue.id, cue);
    }

    for (const cue of manifest?.cues ?? []) {
        if (tracksById.get(cue.trackId)?.kind !== 'record') continue;
        if (!cuesById.has(cue.id)) {
            cuesById.set(cue.id, cue);
        }
    }

    for (const record of draft.records) {
        addRecord(recordsByCueId, toRecordingTake(record, 'draft'));
    }

    for (const record of manifest?.records ?? []) {
        addRecord(recordsByCueId, toRecordingTake(record, 'manifest'));
    }

    for (const cue of manifest?.cues ?? []) {
        if (cue.approvedRecordUrl) {
            addRecord(recordsByCueId, {
                id: -cue.id,
                cueId: cue.id,
                audioUrl: cue.approvedRecordUrl,
                volume: cue.volume,
                isAccepted: true,
                source: 'manifest',
            });
        }
    }

    return Array.from(cuesById.values())
        .map((cue) => {
            const manifestCue = manifestCuesById.get(cue.id);
            const script = scriptsById.get(cue.scriptId);
            const resolvedCharacterId = cue.characterId ?? script?.characterId ?? 0;
            const character = charactersById.get(resolvedCharacterId);
            const track = tracksById.get(cue.trackId);
            const records = recordsByCueId.get(cue.id) ?? [];
            const latestRecord = records.at(-1);

            return {
                id: cue.id,
                cueId: cue.id,
                scriptId: cue.scriptId,
                characterId: resolvedCharacterId,
                characterName: character?.name ?? '미지정',
                characterColor: character?.color ?? '#64748b',
                trackId: cue.trackId,
                trackName: track?.name ?? 'Dialogue',
                text: script?.text ?? `대사 ${cue.id}`,
                sortOrder: script?.sortOrder ?? Number.MAX_SAFE_INTEGER,
                startTime: cue.startTime,
                endTime: cue.endTime,
                durationMs: Math.max(0, cue.endTime - cue.startTime),
                startCanvasMediaId: toOptionalNumber(cue.startCanvasMediaId ?? manifestCue?.startCanvasMediaId),
                endCanvasMediaId: toOptionalNumber(cue.endCanvasMediaId ?? manifestCue?.endCanvasMediaId),
                startPosition: toOptionalNumber(cue.startPosition ?? manifestCue?.startPosition),
                endPosition: toOptionalNumber(cue.endPosition ?? manifestCue?.endPosition),
                status: records.length > 0 ? 'done' : 'pending',
                takeCount: records.length,
                latestRecordUrl: latestRecord?.audioUrl,
                ttsUrl: 'ttsUrl' in cue ? cue.ttsUrl : manifestCue?.ttsUrl,
                records,
            } satisfies RecordingCueQueueItem;
        })
        .filter((item) => !characterId || item.characterId === characterId)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.startTime - right.startTime || left.cueId - right.cueId);
}

export function getRecordingProgress(queue: RecordingCueQueueItem[]): RecordingProgress {
    const total = queue.length;
    const done = queue.filter((item) => item.status === 'done').length;
    const pending = total - done;

    return {
        total,
        done,
        pending,
        percent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
}

export function filterRecordingCueQueue(queue: RecordingCueQueueItem[], filter: RecordingCueFilter): RecordingCueQueueItem[] {
    if (filter === 'all') return queue;
    return queue.filter((item) => item.status === filter);
}

export function selectInitialRecordingCue(queue: RecordingCueQueueItem[]): RecordingCueQueueItem | undefined {
    return queue.find((item) => item.status === 'pending') ?? queue[0];
}

export function buildRecordingCueStripMarkers({
    queue,
    selectedCueId,
}: {
    queue: RecordingCueQueueItem[];
    selectedCueId?: number;
}): RecordingCueStripMarker[] {
    const durationMs = Math.max(1, ...queue.map((item) => item.endTime));

    return queue
        .map((item) => {
            const timePercent = roundPercent(clampTimelinePercent((item.startTime / durationMs) * 100));
            const canvasMediaId = toOptionalNumber(item.startCanvasMediaId);
            const savedPosition = toOptionalNumber(item.startPosition);
            const hasStripPlacement = typeof canvasMediaId === 'number' && typeof savedPosition === 'number';
            const positionPercent = hasStripPlacement
                ? roundPercent(clampPositionPercent(savedPosition))
                : timePercent;

            return {
                cueId: item.cueId,
                characterId: item.characterId,
                characterName: item.characterName,
                characterColor: item.characterColor,
                text: item.text,
                startTime: item.startTime,
                canvasMediaId: hasStripPlacement ? canvasMediaId : undefined,
                positionPercent,
                topPercent: positionPercent,
                status: item.status,
                isSelected: item.cueId === selectedCueId,
            } satisfies RecordingCueStripMarker;
        })
        .sort(
            (left, right) =>
                (left.canvasMediaId ?? Number.MAX_SAFE_INTEGER) - (right.canvasMediaId ?? Number.MAX_SAFE_INTEGER) ||
                left.positionPercent - right.positionPercent ||
                left.startTime - right.startTime ||
                left.cueId - right.cueId,
        );
}

export function getRecordingStorageKey(productId: string, episodeId: string): string {
    return `test-player:recording-studio:${productId}:${episodeId}:takes`;
}

export function toRecordingStripSize(scale: number) {
    const normalizedScale = Math.min(200, Math.max(70, Math.round(Number.isFinite(scale) ? scale : 100)));
    const ratio = normalizedScale / 100;

    return {
        scale: normalizedScale,
        width: Math.round(defaultRecordingStripWidth * ratio),
        panelWidth: Math.max(384, Math.round(defaultRecordingStripWidth * ratio) + 64),
        fallbackHeight: Math.round(defaultRecordingStripFallbackHeight * ratio),
    };
}

function toRecordingTake(record: DraftRecord | RecordManifest, source: RecordingTakeSummary['source']): RecordingTakeSummary {
    return {
        id: record.id,
        cueId: record.cueId,
        audioUrl: record.recordUrl,
        durationMs: record.duration,
        volume: record.volume,
        isAccepted: record.isAccepted,
        source,
    };
}

function addRecord(recordsByCueId: Map<number, RecordingTakeSummary[]>, record: RecordingTakeSummary) {
    const records = recordsByCueId.get(record.cueId) ?? [];
    if (!records.some((existing) => existing.id === record.id || existing.audioUrl === record.audioUrl)) {
        records.push(record);
    }
    recordsByCueId.set(record.cueId, records);
}

function toOptionalNumber(value: number | undefined): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function clampTimelinePercent(value: number): number {
    return Math.min(96, Math.max(4, value));
}

function clampPositionPercent(value: number): number {
    return Math.min(100, Math.max(0, value));
}

function roundPercent(value: number): number {
    return Math.round(value * 100) / 100;
}
