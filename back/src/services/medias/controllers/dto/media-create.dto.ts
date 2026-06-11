import type { MediaType } from '../../domain/media.entity';

export class MediaCreateDto {
    canvasId?: number;
    mediaName!: string;
    mediaType!: MediaType;
    mediaUrl!: string;
    index?: number;
}
