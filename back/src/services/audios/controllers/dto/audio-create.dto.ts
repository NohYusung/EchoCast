import type { AudioType } from '../../domain/audio.entity';

export class AudioCreateDto {
    audioType!: AudioType;
    name!: string;
    audioUrl!: string;
    duration?: number;
}
