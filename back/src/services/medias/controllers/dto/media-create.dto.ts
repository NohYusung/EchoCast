import type { MediaType } from '../../domain/media.entity';

export class MediaCreateDto {
    mediaName!: string;
    mediaType!: MediaType;
    mediaUrl!: string;
    duration?: number;
}
