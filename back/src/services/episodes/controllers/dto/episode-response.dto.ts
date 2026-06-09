import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class EpisodeResponseDto {
    @Expose()
    id!: number;

    @Expose()
    productId!: number;

    @Expose()
    episodeNumber!: number;

    @Expose()
    title!: string;

    @Expose()
    subTitle?: string;
}
