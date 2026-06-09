import { Injectable } from '@nestjs/common';
import { DddRepository } from '../../../libs/ddd';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { stripUndefined } from '../../../libs/utils/helper';
import { Script } from '../domain/script.entity';

@Injectable()
export class ScriptRepository extends DddRepository<Script> {
    entityClass = Script;

    async find(
        conditions: {
            id?: number;
            script?: string;
            characterId?: string;
        },
        options?: TypeormRelationOptions<Script>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Script>({
                id: conditions.id,
                script: conditions.script,
                characterId: conditions.characterId,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: { id?: number; script?: string; characterId?: string }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Script>({
                id: conditions.id,
                script: conditions.script,
                characterId: conditions.characterId,
            }),
        });
    }
}
