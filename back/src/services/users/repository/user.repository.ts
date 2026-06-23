import { Injectable } from '@nestjs/common';
import { DddRepository } from '../../../libs/ddd';
import { stripUndefined } from '../../../libs/utils/helper';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { User, type UserStatus } from '../domain/user.entity';

@Injectable()
export class UserRepository extends DddRepository<User> {
    entityClass = User;

    async find(
        conditions: {
            id?: number;
            email?: string;
            status?: UserStatus;
        },
        options?: TypeormRelationOptions<User>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<User>({
                id: conditions.id,
                email: conditions.email,
                status: conditions.status,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: { id?: number; email?: string; status?: UserStatus }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<User>({
                id: conditions.id,
                email: conditions.email,
                status: conditions.status,
            }),
        });
    }
}
