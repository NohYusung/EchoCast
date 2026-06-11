import { Injectable } from '@nestjs/common';
import { DddRepository } from '../../../libs/ddd';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { stripUndefined } from '../../../libs/utils/helper';
import { Character, type CharacterRole } from '../domain/character.entity';

@Injectable()
export class CharacterRepository extends DddRepository<Character> {
    entityClass = Character;

    async find(
        conditions: {
            id?: number;
            productId?: number;
            name?: string;
            role?: CharacterRole;
        },
        options?: TypeormRelationOptions<Character>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Character>({
                id: conditions.id,
                productId: conditions.productId,
                name: conditions.name,
                role: conditions.role,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: { id?: number; productId?: number; name?: string; role?: CharacterRole }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Character>({
                id: conditions.id,
                productId: conditions.productId,
                name: conditions.name,
                role: conditions.role,
            }),
        });
    }
}
