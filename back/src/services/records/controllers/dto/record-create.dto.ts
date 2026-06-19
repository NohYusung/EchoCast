export class RecordCreateDto {
    cueId!: number;
    artistId?: number | null;
    audioId?: number;
    recordUrl?: string;
    duration?: number;
    isAccepted?: boolean;
}
