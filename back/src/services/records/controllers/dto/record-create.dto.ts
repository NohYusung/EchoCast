export class RecordCreateDto {
    cueId!: number;
    artistId!: number;
    recordUrl!: string;
    duration?: number;
    volume?: number;
    isAccepted?: boolean;
}
