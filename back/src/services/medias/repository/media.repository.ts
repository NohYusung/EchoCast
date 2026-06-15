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
            mediaName?: string;
            mediaType?: MediaType;
            mediaUrl?: string;
            duration?: number;
        },
        options?: TypeormRelationOptions<Media>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Media>({
                id: conditions.id,
                episodeId: conditions.episodeId,
                mediaName: conditions.mediaName,
                mediaType: conditions.mediaType,
                mediaUrl: conditions.mediaUrl,
                duration: conditions.duration,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        episodeId?: number;
        mediaName?: string;
        mediaType?: MediaType;
        mediaUrl?: string;
        duration?: number;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Media>({
                id: conditions.id,
                episodeId: conditions.episodeId,
                mediaName: conditions.mediaName,
                mediaType: conditions.mediaType,
                mediaUrl: conditions.mediaUrl,
                duration: conditions.duration,
            }),
        });
    }

}
