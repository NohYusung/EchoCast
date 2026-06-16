import { Injectable } from '@nestjs/common';
import { DddRepository } from '../../../libs/ddd';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { stripUndefined } from '../../../libs/utils/helper';
import { Episode } from '../domain/episode.entity';

@Injectable()
export class EpisodeRepository extends DddRepository<Episode> {
    entityClass = Episode;

    async find(
        conditions: {
            id?: number;
            productId?: number;
            episodeNumber?: number;
            title?: string;
            subTitle?: string;
            thumbnailImageUrl?: string;
            defaultCanvasId?: number;
        },
        options?: TypeormRelationOptions<Episode>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Episode>({
                id: conditions.id,
                productId: conditions.productId,
                episodeNumber: conditions.episodeNumber,
                title: conditions.title,
                subTitle: conditions.subTitle,
                thumbnailImageUrl: conditions.thumbnailImageUrl,
                defaultCanvasId: conditions.defaultCanvasId,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        productId?: number;
        episodeNumber?: number;
        title?: string;
        subTitle?: string;
        thumbnailImageUrl?: string;
        defaultCanvasId?: number;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Episode>({
                id: conditions.id,
                productId: conditions.productId,
                episodeNumber: conditions.episodeNumber,
                title: conditions.title,
                subTitle: conditions.subTitle,
                thumbnailImageUrl: conditions.thumbnailImageUrl,
                defaultCanvasId: conditions.defaultCanvasId,
            }),
        });
    }
}
