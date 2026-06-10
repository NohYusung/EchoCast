import type { TrackType } from '../../domain/track.entity';

export class TrackCreateDto {
    name!: string;
    type!: TrackType;
    isMuted?: boolean;
}
