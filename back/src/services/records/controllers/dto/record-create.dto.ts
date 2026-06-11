import type { RecordStatus } from '../../domain/record.entity';

export class RecordCreateDto {
    cueId!: number;
    artistId!: number;
    status?: RecordStatus;
    audioUrl!: string;
    durationMs!: number;
    volume?: number;
}
