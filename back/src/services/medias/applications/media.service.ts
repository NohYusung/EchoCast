import { Injectable } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Media, type MediaType } from '../domain/media.entity';
import { MediaRepository } from '../repository/media.repository';

@Injectable()
export class MediaService extends DddService {
    constructor(private readonly mediaRepository: MediaRepository) {
        super();
    }

    async create({
        episodeId,
        mediaType,
        mediaUrl,
        index,
    }: {
        episodeId: number;
        mediaType: MediaType;
        mediaUrl: string;
        index: number;
    }) {
        const media = new Media({
            episodeId,
            mediaType,
            mediaUrl,
            index,
        });

        await this.mediaRepository.save([media]);
        return {
            id: media.id,
            episodeId: media.episodeId,
            mediaType: media.mediaType,
            mediaUrl: media.mediaUrl,
            index: media.index,
        };
    }

    async list({ episodeId }: { episodeId: number }) {
        const [medias, total] = await Promise.all([
            this.mediaRepository.find({ episodeId }),
            this.mediaRepository.count({ episodeId }),
        ]);
        const items = medias.map((media) => ({
            id: media.id,
            episodeId: media.episodeId,
            mediaType: media.mediaType,
            mediaUrl: media.mediaUrl,
            index: media.index,
        }));

        return { items, total };
    }
}
