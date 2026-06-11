import type { AudioType } from '../../domain/audio.entity';

export class AudioCreateDto {
    cueId?: number;
    audioType!: AudioType;
    name!: string;
    audioUrl!: string;
    duration!: number;
}
