import type { TrackType } from '../../../tracks/domain/track.entity';

export class AudioDropDto {
    trackId?: number;
    trackName?: string;
    trackType?: Extract<TrackType, 'audio' | 'bgm' | 'effect' | 'record'>;
    characterId?: number;
    startTime!: number;
    endTime?: number;
    volume?: number;
}
