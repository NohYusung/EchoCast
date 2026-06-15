import type { PlayerManifest } from './playerManifest.types';

export type PlaybackEventKind = 'audio' | 'record' | 'tts';

export interface PlaybackEvent {
    id: string;
    cueId: string;
    kind: PlaybackEventKind;
    sourceId: string;
    url: string;
    startTime: number;
    endTime: number;
    volume: number;
}

export function buildPlaybackEvents(manifest: PlayerManifest): PlaybackEvent[] {
    const recordByCueId = new Map<string, PlayerManifest['records'][number]>();
    for (const record of manifest.records) {
        const currentRecord = recordByCueId.get(record.cueId);
        if (!currentRecord || (!currentRecord.isAccepted && record.isAccepted)) {
            recordByCueId.set(record.cueId, record);
        }
    }
    const ttsByCueId = new Map(manifest.tts.map((tts) => [tts.cueId, tts]));
    const mediaById = new Map(manifest.media.map((media) => [media.id, media]));

    const cuePlaybackEvents = manifest.cues
        .flatMap((cue): PlaybackEvent[] => {
            const record = recordByCueId.get(cue.id);
            if (record) {
                return [
                    {
                        id: `record-event-${record.id}`,
                        cueId: cue.id,
                        kind: 'record',
                        sourceId: record.id,
                        url: record.recordUrl,
                        startTime: cue.startTime,
                        endTime: cue.startTime + (record.duration ?? Math.max(0, cue.endTime - cue.startTime)),
                        volume: record.volume * cue.volume,
                    },
                ];
            }

            const tts = ttsByCueId.get(cue.id);
            if (!tts) return [];

            return [
                {
                    id: `tts-event-${tts.id}`,
                    cueId: cue.id,
                    kind: 'tts',
                    sourceId: tts.id,
                    url: tts.audioUrl,
                    startTime: cue.startTime,
                    endTime: cue.endTime,
                    volume: cue.volume,
                },
            ];
        });
    const audioPlaybackEvents = manifest.items.flatMap((item): PlaybackEvent[] => {
        if ((item.kind !== 'audio' && item.kind !== 'effect') || !item.mediaId) return [];

        const media = mediaById.get(item.mediaId);
        if (!media || (media.kind !== 'audio' && media.kind !== 'effect')) return [];

        return [
            {
                id: `audio-event-${item.id}`,
                cueId: item.cueId ?? item.id,
                kind: 'audio',
                sourceId: item.mediaId,
                url: media.url,
                startTime: item.startTime,
                endTime: item.endTime,
                volume: item.volume,
            },
        ];
    });

    return [...cuePlaybackEvents, ...audioPlaybackEvents].sort(
        (a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id)
    );
}
