import { Injectable } from '@nestjs/common';
import { DddRepository } from '../../../libs/ddd';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { stripUndefined } from '../../../libs/utils/helper';
import { Media, type MediaType } from '../domain/media.entity';

@Injectable()
export class MediaRepository extends DddRepository<Media> {
    entityClass = Media;

    async find(
        conditions: {
            id?: number;
            episodeId?: number;
            canvasId?: number;
            mediaName?: string;
            mediaType?: MediaType;
            mediaUrl?: string;
            index?: number;
        },
        options?: TypeormRelationOptions<Media>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Media>({
                id: conditions.id,
                episodeId: conditions.episodeId,
                canvasId: conditions.canvasId,
                mediaName: conditions.mediaName,
                mediaType: conditions.mediaType,
                mediaUrl: conditions.mediaUrl,
                index: conditions.index,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        episodeId?: number;
        canvasId?: number;
        mediaName?: string;
        mediaType?: MediaType;
        mediaUrl?: string;
        index?: number;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Media>({
                id: conditions.id,
                episodeId: conditions.episodeId,
                canvasId: conditions.canvasId,
                mediaName: conditions.mediaName,
                mediaType: conditions.mediaType,
                mediaUrl: conditions.mediaUrl,
                index: conditions.index,
            }),
        });
    }

    async findByEpisodeId(episodeId: number) {
        return this.find({ episodeId }, { options: { sort: 'index', order: 'ASC' } });
    }

    async countByEpisodeId(episodeId: number) {
        return this.count({ episodeId });
    }

    async findOneByEpisodeId({ episodeId, mediaId }: { episodeId: number; mediaId: number }) {
        const [media] = await this.find({ id: mediaId, episodeId });

        return media;
    }
}
