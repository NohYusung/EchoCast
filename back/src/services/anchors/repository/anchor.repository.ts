import { Injectable } from '@nestjs/common';
import { DddRepository } from '../../../libs/ddd';
import { stripUndefined } from '../../../libs/utils/helper';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { Anchor } from '../domain/anchor.entity';

@Injectable()
export class AnchorRepository extends DddRepository<Anchor> {
    entityClass = Anchor;

    async find(
        conditions: {
            id?: number;
            trackId?: number;
            canvasId?: number;
            time?: number;
            position?: number;
            index?: number;
        },
        options?: TypeormRelationOptions<Anchor>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Anchor>({
                id: conditions.id,
                trackId: conditions.trackId,
                canvasId: conditions.canvasId,
                time: conditions.time,
                position: conditions.position,
                index: conditions.index,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        trackId?: number;
        canvasId?: number;
        time?: number;
        position?: number;
        index?: number;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Anchor>({
                id: conditions.id,
                trackId: conditions.trackId,
                canvasId: conditions.canvasId,
                time: conditions.time,
                position: conditions.position,
                index: conditions.index,
            }),
        });
    }
}
