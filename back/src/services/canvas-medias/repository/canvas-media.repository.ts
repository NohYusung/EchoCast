import { Injectable } from '@nestjs/common';
import type { FindOperator } from 'typeorm';
import { DddRepository } from '../../../libs/ddd';
import { stripUndefined } from '../../../libs/utils/helper';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { CanvasMedia } from '../domain/canvas-media.entity';

@Injectable()
export class CanvasMediaRepository extends DddRepository<CanvasMedia> {
    entityClass = CanvasMedia;

    async find(
        conditions: {
            id?: number;
            canvasId?: number | FindOperator<number>;
            mediaId?: number | FindOperator<number>;
            index?: number;
        },
        options?: TypeormRelationOptions<CanvasMedia>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<CanvasMedia>({
                id: conditions.id,
                canvasId: conditions.canvasId,
                mediaId: conditions.mediaId,
                index: conditions.index,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        canvasId?: number | FindOperator<number>;
        mediaId?: number | FindOperator<number>;
        index?: number;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<CanvasMedia>({
                id: conditions.id,
                canvasId: conditions.canvasId,
                mediaId: conditions.mediaId,
                index: conditions.index,
            }),
        });
    }
}
