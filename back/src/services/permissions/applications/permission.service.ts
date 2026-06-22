import { Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Permission } from '../domain/permission.entity';
import { PermissionRepository } from '../repository/permission.repository';

@Injectable()
export class PermissionService extends DddService {
    constructor(private readonly permissionRepository: PermissionRepository) {
        super();
    }

    async create({ name, description }: { name: string; description: string }) {
        const permission = new Permission({ name, description });

        await this.permissionRepository.save([permission]);
    }

    async list() {
        const [permissions, total] = await Promise.all([
            this.permissionRepository.find({}, { options: { sort: 'id', order: 'ASC' } }),
            this.permissionRepository.count({}),
        ]);
        const items = permissions.map((permission) => ({
            id: permission.id,
            name: permission.name,
            description: permission.description,
        }));

        return { items, total };
    }

    async update({
        permissionId,
        name,
        description,
    }: {
        permissionId: number;
        name?: string;
        description?: string;
    }) {
        const [permission] = await this.permissionRepository.find({ id: permissionId });

        if (!permission) {
            throw new NotFoundException('권한을 찾을 수 없습니다.');
        }

        permission.update({ name, description });
        await this.permissionRepository.save([permission]);
    }

    async delete({ permissionId }: { permissionId: number }) {
        const [permission] = await this.permissionRepository.find({ id: permissionId });

        if (!permission) {
            throw new NotFoundException('권한을 찾을 수 없습니다.');
        }

        await this.permissionRepository.softRemove([permission]);
    }
}
