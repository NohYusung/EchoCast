import { Injectable, NotFoundException } from '@nestjs/common';
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
        mediaName,
        mediaType,
        mediaUrl,
        duration,
    }: {
        episodeId: number;
        mediaName: string;
        mediaType: MediaType;
        mediaUrl: string;
        duration?: number;
    }) {
        const media = new Media({
            episodeId,
            mediaName,
            mediaType,
            mediaUrl,
            duration,
        });
        await this.mediaRepository.save([media]);

        return {
            id: media.id,
            episodeId: media.episodeId,
            canvasId: undefined,
            mediaName: media.mediaName,
            mediaType: media.mediaType,
            mediaUrl: media.mediaUrl,
            ...(typeof media.duration === 'number' ? { duration: media.duration } : {}),
        };
    }

    async list({ episodeId }: { episodeId: number }) {
        const [medias, total] = await Promise.all([
            this.mediaRepository.findByEpisodeId(episodeId),
            this.mediaRepository.countByEpisodeId(episodeId),
        ]);
        const items = medias.map((media) => {
            return {
                id: media.id,
                episodeId: media.episodeId,
                canvasId: undefined,
                mediaName: media.mediaName,
                mediaType: media.mediaType,
                mediaUrl: media.mediaUrl,
                ...(typeof media.duration === 'number' ? { duration: media.duration } : {}),
            };
        });

        return { items, total };
    }

    async delete({ episodeId, mediaId }: { episodeId: number; mediaId: number }) {
        const media = await this.mediaRepository.findOneByEpisodeId({ episodeId, mediaId });

        if (!media) {
            throw new NotFoundException('Media not found.');
        }

        await this.mediaRepository.softRemove([media]);
    }
}
