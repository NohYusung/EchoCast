import { Injectable } from '@nestjs/common';
import type { FindOperator } from 'typeorm';
import { DddRepository } from '../../../libs/ddd';
import { stripUndefined } from '../../../libs/utils/helper';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { Pause } from '../domain/pause.entity';

@Injectable()
export class PauseRepository extends DddRepository<Pause> {
    entityClass = Pause;

    async find(
        conditions: {
            id?: number;
            trackId?: number | FindOperator<number>;
            anchorId?: number;
            duration?: number;
        },
        options?: TypeormRelationOptions<Pause>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Pause>({
                id: conditions.id,
                trackId: conditions.trackId,
                anchorId: conditions.anchorId,
                duration: conditions.duration,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        trackId?: number | FindOperator<number>;
        anchorId?: number;
        duration?: number;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Pause>({
                id: conditions.id,
                trackId: conditions.trackId,
                anchorId: conditions.anchorId,
                duration: conditions.duration,
            }),
        });
    }
}
