import type { PlayerManifest } from './playerManifest.types';

export type PlaybackEventKind = 'audio' | 'tts';

export interface PlaybackEvent {
    id: string;
    cueId: number;
    kind: PlaybackEventKind;
    sourceId: number;
    url: string;
    startTime: number;
    endTime: number;
    sourceStartTime: number;
    volume: number;
}

export function buildPlaybackEvents(manifest: PlayerManifest): PlaybackEvent[] {
    const ttsByCueId = new Map(manifest.tts.map((tts) => [tts.cueId, tts]));

    const cuePlaybackEvents = manifest.cues.flatMap((cue): PlaybackEvent[] => {
        if (typeof cue.audioId === 'number') {
            return [];
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
                sourceStartTime: 0,
                volume: cue.volume,
            },
        ];
    });
    const audioPlaybackEvents = manifest.items.flatMap((item): PlaybackEvent[] => {
        if ((item.kind !== 'audio' && item.kind !== 'effect') || !item.mediaId) return [];

        const media = manifest.media.find(
            (media) => media.id === item.mediaId && (media.kind === 'audio' || media.kind === 'effect')
        );
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
                sourceStartTime: item.trimStartTime ?? 0,
                volume: item.volume,
            },
        ];
    });

    return [...cuePlaybackEvents, ...audioPlaybackEvents].sort(
        (a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id)
    );
}
