export class CanvasCreateMediaDto {
    mediaId!: number;
    index?: number;
    startTime?: number;
    endTime?: number;
    sourceStartTime?: number;
    sourceEndTime?: number;
    volume?: number;
    isMuted?: boolean;
}

export class CanvasCreateDto {
    medias!: CanvasCreateMediaDto[];
}
