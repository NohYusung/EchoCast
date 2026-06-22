import { Injectable } from '@nestjs/common';
import type { FindOperator } from 'typeorm';
import { DddRepository } from '../../../libs/ddd';
import { stripUndefined } from '../../../libs/utils/helper';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { Permission } from '../domain/permission.entity';

@Injectable()
export class PermissionRepository extends DddRepository<Permission> {
    entityClass = Permission;

    async find(
        conditions: {
            id?: number | FindOperator<number>;
            name?: string;
            description?: string;
        },
        options?: TypeormRelationOptions<Permission>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Permission>({
                id: conditions.id,
                name: conditions.name,
                description: conditions.description,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: { id?: number; name?: string; description?: string }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Permission>({
                id: conditions.id,
                name: conditions.name,
                description: conditions.description,
            }),
        });
    }
}
