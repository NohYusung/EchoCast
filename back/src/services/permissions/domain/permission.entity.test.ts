import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Role } from '../../roles/domain/role.entity';
import { User } from '../../users/domain/user.entity';
import { Permission } from './permission.entity';

describe('Permission entity', () => {
    it('stores permission metadata with role relation', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Permission, Role, User],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const metadata = dataSource.getMetadata(Permission);
            const columnNames = metadata.columns.map((column) => column.propertyName);

            assert.equal(metadata.tableName, 'permissions');
            assert.equal(columnNames.includes('name'), true);
            assert.equal(columnNames.includes('description'), true);
            assert.ok(metadata.findRelationWithPropertyPath('roles'));

            const permission = await dataSource.manager.save(
                new Permission({
                    name: 'record.accept',
                    description: '녹음 채택 권한',
                })
            );
            const storedPermission = await dataSource.manager.findOneByOrFail(Permission, { id: permission.id });

            assert.equal(storedPermission.name, 'record.accept');
            assert.equal(storedPermission.description, '녹음 채택 권한');
        } finally {
            await dataSource.destroy();
        }
    });
});
