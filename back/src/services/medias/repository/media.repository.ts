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
            mediaType?: MediaType;
            mediaUrl?: string;
        },
        options?: TypeormRelationOptions<Media>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Media>({
                id: conditions.id,
                mediaType: conditions.mediaType,
                mediaUrl: conditions.mediaUrl,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: { id?: number; mediaType?: MediaType; mediaUrl?: string }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Media>({
                id: conditions.id,
                mediaType: conditions.mediaType,
                mediaUrl: conditions.mediaUrl,
            }),
        });
    }
}
