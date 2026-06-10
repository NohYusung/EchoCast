import type { MediaType } from '../../domain/media.entity';

export class MediaCreateDto {
    mediaType!: MediaType;
    mediaUrl!: string;
    index!: number;
}
