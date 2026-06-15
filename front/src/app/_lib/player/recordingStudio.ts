import type { PlayerDraft } from './playerDraft.types';
import type { CueManifest, PlayerManifest, RecordManifest } from './playerManifest.types';

export type RecordingCueFilter = 'all' | 'pending' | 'done';
export type RecordingCueStatus = 'pending' | 'done';

export interface RecordingTakeSummary {
    id: string;
    cueId: string;
    audioUrl: string;
    durationMs?: number;
    volume: number;
    isAccepted: boolean;
    source: 'draft' | 'manifest';
}

export interface RecordingCueQueueItem {
    id: string;
    cueId: string;
    scriptId: string;
    characterId: string;
    characterName: string;
    characterColor: string;
    trackId: string;
    trackName: string;
    text: string;
    sortOrder: number;
    startTime: number;
    endTime: number;
    durationMs: number;
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

type DraftCue = PlayerDraft['cues'][number];
type DraftRecord = PlayerDraft['records'][number];
type RecordingCueSource = DraftCue | CueManifest;

export function buildRecordingCueQueue({
    draft,
    manifest,
    characterId,
}: {
    draft: PlayerDraft;
    manifest?: PlayerManifest;
    characterId?: string;
}): RecordingCueQueueItem[] {
    const scriptsById = new Map(draft.scripts.map((script) => [script.id, script]));
    const charactersById = new Map(draft.characters.map((character) => [character.id, character]));
    const tracksById = new Map(draft.tracks.map((track) => [track.id, track]));
    const manifestCuesById = new Map((manifest?.cues ?? []).map((cue) => [cue.id, cue]));
    const cuesById = new Map<string, RecordingCueSource>();
    const recordsByCueId = new Map<string, RecordingTakeSummary[]>();

    for (const cue of draft.cues) {
        cuesById.set(cue.id, cue);
    }

    for (const cue of manifest?.cues ?? []) {
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
                id: `approved-${cue.id}`,
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
            const resolvedCharacterId = cue.characterId ?? script?.characterId ?? '';
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
                status: records.length > 0 ? 'done' : 'pending',
                takeCount: records.length,
                latestRecordUrl: latestRecord?.audioUrl,
                ttsUrl: 'ttsUrl' in cue ? cue.ttsUrl : manifestCue?.ttsUrl,
                records,
            } satisfies RecordingCueQueueItem;
        })
        .filter((item) => !characterId || item.characterId === characterId)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.startTime - right.startTime || left.cueId.localeCompare(right.cueId));
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

export function getRecordingStorageKey(productId: string, episodeId: string): string {
    return `test-player:recording-studio:${productId}:${episodeId}:takes`;
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

function addRecord(recordsByCueId: Map<string, RecordingTakeSummary[]>, record: RecordingTakeSummary) {
    const records = recordsByCueId.get(record.cueId) ?? [];
    if (!records.some((existing) => existing.id === record.id || existing.audioUrl === record.audioUrl)) {
        records.push(record);
    }
    recordsByCueId.set(record.cueId, records);
}
