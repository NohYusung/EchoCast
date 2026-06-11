import type { MediaType } from '../../domain/media.entity';

export class MediaCreateDto {
    canvasId?: number;
    mediaType!: MediaType;
    mediaUrl!: string;
    index?: number;
}
