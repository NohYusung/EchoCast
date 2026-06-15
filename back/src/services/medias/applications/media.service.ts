import { Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Transactional } from '../../../libs/decorators/transactional.decorator';
import { Media, type MediaType } from '../domain/media.entity';
import { MediaRepository } from '../repository/media.repository';

@Injectable()
export class MediaService extends DddService {
    constructor(private readonly mediaRepository: MediaRepository) {
        super();
    }

    @Transactional()
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
    }

    async list({ episodeId }: { episodeId: number }) {
        const [medias, total] = await Promise.all([
            this.mediaRepository.find({ episodeId }, { options: { sort: 'id', order: 'ASC' } }),
            this.mediaRepository.count({ episodeId }),
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

    @Transactional()
    async delete({ episodeId, mediaId }: { episodeId: number; mediaId: number }) {
        const [media] = await this.mediaRepository.find({ id: mediaId, episodeId });

        if (!media) {
            throw new NotFoundException('미디어를 찾을 수 없습니다.');
        }

        await this.mediaRepository.softRemove([media]);
    }
}
