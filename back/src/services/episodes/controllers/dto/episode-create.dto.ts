export class EpisodeCreateDto {
    episodeNumber!: number;
    title!: string;
    subTitle?: string;
    thumbnailImageUrl?: string;
    defaultCanvasId?: number;
}
