import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Permission } from '../../permissions/domain/permission.entity';
import { User } from '../../users/domain/user.entity';
import { Role } from './role.entity';

describe('Role entity', () => {
    it('stores role metadata and owns RBAC join tables', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Permission, Role, User],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const metadata = dataSource.getMetadata(Role);
            const columnNames = metadata.columns.map((column) => column.propertyName);

            assert.equal(metadata.tableName, 'roles');
            assert.equal(columnNames.includes('name'), true);
            assert.equal(columnNames.includes('description'), true);
            assert.ok(metadata.findRelationWithPropertyPath('permissions'));
            assert.ok(metadata.findRelationWithPropertyPath('users'));

            const permission = await dataSource.manager.save(
                new Permission({
                    name: 'record.create',
                    description: '녹음 생성 권한',
                })
            );
            const user = await dataSource.manager.save(
                new User({
                    email: 'rbac@example.com',
                    password: 'hashed-password',
                    name: 'RBAC User',
                })
            );
            const role = new Role({
                name: 'artist',
                description: '성우 역할',
            });
            role.permissions = [permission];
            role.users = [user];
            const savedRole = await dataSource.manager.save(role);

            const storedRole = await dataSource.manager.findOneOrFail(Role, {
                where: { id: savedRole.id },
                relations: { permissions: true, users: true },
            });

            assert.equal(storedRole.name, 'artist');
            assert.equal(storedRole.description, '성우 역할');
            assert.equal(storedRole.permissions?.[0]?.name, 'record.create');
            assert.equal(storedRole.users?.[0]?.email, 'rbac@example.com');
        } finally {
            await dataSource.destroy();
        }
    });
});
