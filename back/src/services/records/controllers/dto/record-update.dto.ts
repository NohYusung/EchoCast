export class RecordUpdateDto {
    cueId?: number;
    artistId?: number | null;
    recordUrl?: string;
    duration?: number;
    volume?: number;
    isAccepted?: boolean;
}
