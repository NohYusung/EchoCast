import { Injectable } from '@nestjs/common';
import { DddRepository } from '../../../libs/ddd';
import { stripUndefined } from '../../../libs/utils/helper';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { Canvas } from '../domain/canvas.entity';

@Injectable()
export class CanvasRepository extends DddRepository<Canvas> {
    entityClass = Canvas;

    async find(
        conditions: {
            id?: number;
            episodeId?: number;
        },
        options?: TypeormRelationOptions<Canvas>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Canvas>({
                id: conditions.id,
                episodeId: conditions.episodeId,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: { id?: number; episodeId?: number }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Canvas>({
                id: conditions.id,
                episodeId: conditions.episodeId,
            }),
        });
    }
}
