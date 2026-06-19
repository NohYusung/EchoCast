import { getCueApiIdFromTimelineClipId } from './cueTimelinePersistence';

export type RecordPlaybackTrack = {
    id: string;
    kind?: string;
};

export type RecordPlaybackRecord = {
    id: number;
    cueId: number;
    recordUrl?: string;
    duration?: number;
    isAccepted: boolean;
};

export type RecordPlaybackTimelineClip = {
    id: string;
    track: string;
    audioUrl?: string;
    audioStart?: number;
    audioEnd?: number;
    audioDuration?: number;
    sublabel: string;
    volume?: number;
};

function toTimelineSeconds(time: number) {
    return Number((time / 1000).toFixed(3));
}

export function applyAcceptedRecordsToTimelineClips<TClip extends RecordPlaybackTimelineClip>({
    clips,
    records,
    tracks,
}: {
    clips: TClip[];
    records: RecordPlaybackRecord[];
    tracks: RecordPlaybackTrack[];
}): TClip[] {
    const recordTrackIds = new Set(tracks.filter((track) => track.kind === 'record').map((track) => track.id));
    const acceptedRecordByCueId = new Map<string, RecordPlaybackRecord>();

    for (const record of records) {
        if (record.isAccepted && record.recordUrl) {
            acceptedRecordByCueId.set(String(record.cueId), record);
        }
    }

    return clips.map((clip) => {
        if (!recordTrackIds.has(clip.track)) return clip;

        const cueId = getCueApiIdFromTimelineClipId(clip.id);
        const record = cueId ? acceptedRecordByCueId.get(cueId) : undefined;

        if (!record) return clip;

        const isAlreadyUsingRecord = clip.audioUrl === record.recordUrl;
        const recordDuration =
            typeof record.duration === 'number' && record.duration > 0 ? toTimelineSeconds(record.duration) : undefined;

        return {
            ...clip,
            audioUrl: record.recordUrl,
            audioStart: undefined,
            audioEnd: undefined,
            audioDuration: recordDuration ?? clip.audioDuration,
            sublabel: `record ${record.id}`,
            volume: isAlreadyUsingRecord ? clip.volume : (clip.volume ?? 1),
        };
    });
}
