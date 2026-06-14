import { Exclude, Expose, Type } from 'class-transformer';
import type { AudioType } from '../../../audios/domain/audio.entity';
import type { TrackType } from '../../domain/track.entity';

@Exclude()
export class TrackCueAudioResponseDto {
    @Expose()
    id!: number;

    @Expose()
    audioType!: AudioType;

    @Expose()
    name!: string;

    @Expose()
    audioUrl!: string;

    @Expose()
    duration?: number;
}

@Exclude()
export class TrackCueResponseDto {
    @Expose()
    id!: number;

    @Expose()
    script!: string;

    @Expose()
    characterId?: number;

    @Expose()
    trackId!: number;

    @Expose()
    audioId?: number;

    @Expose()
    @Type(() => TrackCueAudioResponseDto)
    audio?: TrackCueAudioResponseDto;

    @Expose()
    startTime!: number;

    @Expose()
    endTime!: number;

    @Expose()
    ttsVoiceId?: number;

    @Expose()
    volume!: number;
}

@Exclude()
export class TrackScrollResponseDto {
    @Expose()
    id!: number;

    @Expose()
    trackId!: number;

    @Expose()
    startAnchorId!: number;

    @Expose()
    endAnchorId!: number;

    @Expose()
    canvasId?: number;

    @Expose()
    startIndex!: number;

    @Expose()
    endIndex!: number;

    @Expose()
    startTime!: number;

    @Expose()
    endTime!: number;

    @Expose()
    startPosition!: number;

    @Expose()
    endPosition!: number;
}

@Exclude()
export class TrackResponseDto {
    @Expose()
    id!: number;

    @Expose()
    episodeId!: number;

    @Expose()
    name!: string;

    @Expose()
    type!: TrackType;

    @Expose()
    characterId?: number;

    @Expose()
    isMuted!: boolean;

    @Expose()
    @Type(() => TrackCueResponseDto)
    cues!: TrackCueResponseDto[];

    @Expose()
    @Type(() => TrackScrollResponseDto)
    scrolls!: TrackScrollResponseDto[];
}
