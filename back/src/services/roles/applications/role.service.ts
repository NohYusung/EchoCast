import { Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { checkInValue } from '../../../libs/utils/typeorm';
import { Permission } from '../../permissions/domain/permission.entity';
import { PermissionRepository } from '../../permissions/repository/permission.repository';
import { Role } from '../domain/role.entity';
import { RoleRepository } from '../repository/role.repository';

@Injectable()
export class RoleService extends DddService {
    constructor(
        private readonly roleRepository: RoleRepository,
        private readonly permissionRepository: PermissionRepository
    ) {
        super();
    }

    async create({
        name,
        description,
        permissionIds = [],
    }: {
        name: string;
        description: string;
        permissionIds?: number[];
    }) {
        const role = new Role({ name, description });

        role.permissions = await this.resolvePermissions({ permissionIds });
        await this.roleRepository.save([role]);
    }

    async list() {
        const [roles, total] = await Promise.all([
            this.roleRepository.find(
                {},
                {
                    relations: { permissions: true },
                    options: { sort: 'id', order: 'ASC' },
                }
            ),
            this.roleRepository.count({}),
        ]);
        const items = roles.map((role) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            permissions: this.serializePermissions({ permissions: role.permissions ?? [] }),
        }));

        return { items, total };
    }

    async update({
        roleId,
        name,
        description,
        permissionIds,
    }: {
        roleId: number;
        name?: string;
        description?: string;
        permissionIds?: number[];
    }) {
        const [role] = await this.roleRepository.find({ id: roleId }, { relations: { permissions: true } });

        if (!role) {
            throw new NotFoundException('역할을 찾을 수 없습니다.');
        }

        role.update({ name, description });

        if (permissionIds !== undefined) {
            role.permissions = await this.resolvePermissions({ permissionIds });
        }

        await this.roleRepository.save([role]);
    }

    async delete({ roleId }: { roleId: number }) {
        const [role] = await this.roleRepository.find({ id: roleId });

        if (!role) {
            throw new NotFoundException('역할을 찾을 수 없습니다.');
        }

        await this.roleRepository.softRemove([role]);
    }

    private async resolvePermissions({ permissionIds }: { permissionIds: number[] }) {
        const uniquePermissionIds = [...new Set(permissionIds)];

        if (uniquePermissionIds.length === 0) {
            return [];
        }

        const permissions = await this.permissionRepository.find(
            { id: checkInValue(uniquePermissionIds) },
            { options: { sort: 'id', order: 'ASC' } }
        );

        if (permissions.length !== uniquePermissionIds.length) {
            throw new NotFoundException('권한을 찾을 수 없습니다.');
        }

        return permissions;
    }

    private serializePermissions({ permissions }: { permissions: Permission[] }) {
        return permissions.map((permission) => ({
            id: permission.id,
            name: permission.name,
            description: permission.description,
        }));
    }
}
