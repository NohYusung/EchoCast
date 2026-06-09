import { Injectable } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { EpisodeResponseDto } from '../controllers/dto';
import { Episode } from '../domain/episode.entity';
import { EpisodeRepository } from '../repository/episode.repository';

@Injectable()
export class EpisodeService extends DddService {
    constructor(private readonly episodeRepository: EpisodeRepository) {
        super();
    }

    async create({
        productId,
        episodeNumber,
        title,
        subTitle,
    }: {
        productId: number;
        episodeNumber: number;
        title: string;
        subTitle?: string;
    }) {
        const episode = new Episode({
            productId,
            episodeNumber,
            title,
            subTitle,
        });

        await this.episodeRepository.save([episode]);
    }

    async list({ productId }: { productId: number }) {
        const [episodes, total] = await Promise.all([
            this.episodeRepository.find({ productId }),
            this.episodeRepository.count({ productId }),
        ]);
        const items = episodes.map((episode) => episode.toInstance(EpisodeResponseDto));

        return { items, total };
    }
}
