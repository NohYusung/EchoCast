import { Injectable } from '@nestjs/common';
import type { FindOperator } from 'typeorm';
import { DddRepository } from '../../../libs/ddd';
import { stripUndefined } from '../../../libs/utils/helper';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { Script } from '../domain/script.entity';

@Injectable()
export class ScriptRepository extends DddRepository<Script> {
    entityClass = Script;

    async find(
        conditions: {
            id?: number | FindOperator<number>;
            line?: string;
        },
        options?: TypeormRelationOptions<Script>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Script>({
                id: conditions.id,
                line: conditions.line,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        line?: string;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Script>({
                id: conditions.id,
                line: conditions.line,
            }),
        });
    }
}
