export class RecordCreateDto {
    cueId!: number;
    artistId!: number;
    audioUrl!: string;
    duration?: number;
    volume?: number;
}
