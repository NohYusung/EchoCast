import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { JwtHelperService } from '../jwt-helper';
import { DddEvent } from '../../libs/ddd';
import { Permission } from '../../services/permissions/domain/permission.entity';
import { PermissionRepository } from '../../services/permissions/repository/permission.repository';
import { Role } from '../../services/roles/domain/role.entity';
import { User } from '../../services/users/domain/user.entity';
import { PermissionGuard, Permissions } from './permission.guard';

class TestController {
    @Permissions('project:view')
    protectedRoute() {}

    publicRoute() {}
}

test('PermissionGuard allows routes without permission metadata', async () => {
    const permissionRepository = {
        find: async () => {
            throw new Error('permission lookup should not run');
        },
    } as unknown as PermissionRepository;
    const guard = new PermissionGuard(permissionRepository, new JwtHelperService(), new Reflector());
    const context = createExecutionContext({
        handler: TestController.prototype.publicRoute,
        request: { headers: {} },
    });

    assert.equal(await guard.canActivate(context), true);
});

test('PermissionGuard allows users with a role mapped to the required permission', async () => {
    const dataSource = await createPermissionGuardDataSource();

    try {
        const user = await dataSource.manager.save(
            new User({
                email: 'allowed@example.com',
                password: 'password',
                name: '권한 사용자',
            })
        );
        const permission = await dataSource.manager.save(
            new Permission({
                name: 'project:view',
                description: '프로젝트 조회',
            })
        );
        const role = new Role({
            name: '프로젝트 조회자',
            description: '프로젝트 조회 역할',
        });
        role.permissions = [permission];
        role.users = [user];
        await dataSource.manager.save(role);

        const guard = new PermissionGuard(new PermissionRepository(dataSource), new JwtHelperService(), new Reflector());
        const context = createExecutionContext({
            handler: TestController.prototype.protectedRoute,
            request: { headers: { 'x-user-id': String(user.id) } },
        });

        assert.equal(await guard.canActivate(context), true);
    } finally {
        await dataSource.destroy();
    }
});

test('PermissionGuard rejects authenticated users without the required permission', async () => {
    const dataSource = await createPermissionGuardDataSource();

    try {
        const user = await dataSource.manager.save(
            new User({
                email: 'denied@example.com',
                password: 'password',
                name: '권한 없는 사용자',
            })
        );
        await dataSource.manager.save(
            new Permission({
                name: 'project:view',
                description: '프로젝트 조회',
            })
        );

        const guard = new PermissionGuard(new PermissionRepository(dataSource), new JwtHelperService(), new Reflector());
        const context = createExecutionContext({
            handler: TestController.prototype.protectedRoute,
            request: { headers: { 'x-user-id': String(user.id) } },
        });

        await assert.rejects(() => guard.canActivate(context), ForbiddenException);
    } finally {
        await dataSource.destroy();
    }
});

test('PermissionGuard rejects permission routes without user identity', async () => {
    const permissionRepository = {
        find: async () => [],
    } as unknown as PermissionRepository;
    const guard = new PermissionGuard(permissionRepository, new JwtHelperService(), new Reflector());
    const context = createExecutionContext({
        handler: TestController.prototype.protectedRoute,
        request: { headers: {} },
    });

    await assert.rejects(() => guard.canActivate(context), UnauthorizedException);
});

function createExecutionContext({
    handler,
    request,
}: {
    handler: () => void;
    request: {
        headers: Record<string, string>;
    };
}) {
    return {
        getClass: () => TestController,
        getHandler: () => handler,
        switchToHttp: () => ({
            getRequest: () => request,
        }),
    } as unknown as ExecutionContext;
}

async function createPermissionGuardDataSource() {
    const dataSource = new DataSource({
        type: 'sqljs',
        entities: [DddEvent, Permission, Role, User],
        synchronize: true,
        logging: false,
    });

    await dataSource.initialize();

    return dataSource;
}
