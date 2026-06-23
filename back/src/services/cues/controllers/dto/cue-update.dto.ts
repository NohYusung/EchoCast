export class CueUpdateDto {
    targetTrackId?: number;
    script?: string;
    duration?: number;
    startTime?: number;
    endTime?: number;
    startCanvasMediaId?: number;
    endCanvasMediaId?: number;
    audioId?: number;
    audioStartTime?: number;
    audioEndTime?: number;
    startPosition?: number;
    endPosition?: number;
    volume?: number;
}
