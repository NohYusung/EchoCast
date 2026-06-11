import { Injectable, NotFoundException } from '@nestjs/common';
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
        thumbnailImageUrl,
    }: {
        productId: number;
        episodeNumber: number;
        title: string;
        subTitle?: string;
        thumbnailImageUrl?: string;
    }) {
        const episode = new Episode({
            productId,
            episodeNumber,
            title,
            subTitle,
            thumbnailImageUrl,
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

    async retrieve({ productId, episodeId }: { productId: number; episodeId: number }) {
        const [episode] = await this.episodeRepository.find({ id: episodeId, productId });

        if (!episode) {
            throw new NotFoundException('Episode not found.');
        }

        return episode.toInstance(EpisodeResponseDto);
    }

    async update({
        productId,
        episodeId,
        episodeNumber,
        title,
        subTitle,
        thumbnailImageUrl,
    }: {
        productId: number;
        episodeId: number;
        episodeNumber?: number;
        title?: string;
        subTitle?: string;
        thumbnailImageUrl?: string;
    }) {
        const [episode] = await this.episodeRepository.find({ id: episodeId, productId });

        if (!episode) {
            throw new NotFoundException('Episode not found.');
        }

        episode.update({ episodeNumber, title, subTitle, thumbnailImageUrl });
        await this.episodeRepository.save([episode]);
    }
}
