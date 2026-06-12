export class CanvasCreateMediaDto {
    mediaId!: number;
    index?: number;
}

export class CanvasCreateDto {
    medias!: CanvasCreateMediaDto[];
}
