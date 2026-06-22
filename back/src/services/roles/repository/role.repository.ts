import { Injectable } from '@nestjs/common';
import type { FindOperator } from 'typeorm';
import { DddRepository } from '../../../libs/ddd';
import { stripUndefined } from '../../../libs/utils/helper';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { Role } from '../domain/role.entity';

@Injectable()
export class RoleRepository extends DddRepository<Role> {
    entityClass = Role;

    async find(
        conditions: {
            id?: number | FindOperator<number>;
            name?: string;
            description?: string;
        },
        options?: TypeormRelationOptions<Role>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Role>({
                id: conditions.id,
                name: conditions.name,
                description: conditions.description,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: { id?: number; name?: string; description?: string }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Role>({
                id: conditions.id,
                name: conditions.name,
                description: conditions.description,
            }),
        });
    }
}
