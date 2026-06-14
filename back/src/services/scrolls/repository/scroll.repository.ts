import { Injectable } from '@nestjs/common';
import type { FindOperator } from 'typeorm';
import { DddRepository } from '../../../libs/ddd';
import { stripUndefined } from '../../../libs/utils/helper';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { Scroll } from '../domain/scroll.entity';

@Injectable()
export class ScrollRepository extends DddRepository<Scroll> {
    entityClass = Scroll;

    async find(
        conditions: {
            id?: number;
            trackId?: number | FindOperator<number>;
            startAnchorId?: number;
            endAnchorId?: number;
        },
        options?: TypeormRelationOptions<Scroll>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Scroll>({
                id: conditions.id,
                trackId: conditions.trackId,
                startAnchorId: conditions.startAnchorId,
                endAnchorId: conditions.endAnchorId,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        trackId?: number | FindOperator<number>;
        startAnchorId?: number;
        endAnchorId?: number;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Scroll>({
                id: conditions.id,
                trackId: conditions.trackId,
                startAnchorId: conditions.startAnchorId,
                endAnchorId: conditions.endAnchorId,
            }),
        });
    }
}
