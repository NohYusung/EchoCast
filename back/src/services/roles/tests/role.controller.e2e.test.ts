import assert from 'node:assert/strict';
import test from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app.module';

test('POST /roles creates a role with permissions and PUT /roles/:roleId updates mappings', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const baseName = `role.permission.${Date.now()}`;
        const readPermissionName = `${baseName}.read`;
        const writePermissionName = `${baseName}.write`;

        await request(app.getHttpServer())
            .post('/permissions')
            .send({ name: readPermissionName, description: '읽기 권한' })
            .expect(201);
        await request(app.getHttpServer())
            .post('/permissions')
            .send({ name: writePermissionName, description: '쓰기 권한' })
            .expect(201);

        const permissionsResponse = await request(app.getHttpServer()).get('/permissions').expect(200);
        const readPermission = permissionsResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === readPermissionName
        );
        const writePermission = permissionsResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === writePermissionName
        );
        assert.ok(readPermission);
        assert.ok(writePermission);

        const roleName = `role.create.${Date.now()}`;
        const createResponse = await request(app.getHttpServer())
            .post('/roles')
            .send({
                name: roleName,
                description: '역할 생성 테스트',
                permissionIds: [readPermission.id, writePermission.id],
            })
            .expect(201);

        assert.deepEqual(createResponse.body, { data: {} });

        const listResponse = await request(app.getHttpServer()).get('/roles').expect(200);
        const role = listResponse.body.data.items.find((item: { id: number; name: string }) => item.name === roleName);
        assert.ok(role);
        assert.deepEqual(
            role.permissions.map((permission: { id: number }) => permission.id).sort((a: number, b: number) => a - b),
            [readPermission.id, writePermission.id].sort((a: number, b: number) => a - b)
        );

        const updatedRoleName = `role.update.${Date.now()}`;
        const updateResponse = await request(app.getHttpServer())
            .put(`/roles/${role.id}`)
            .send({
                name: updatedRoleName,
                description: '역할 수정 테스트',
                permissionIds: [readPermission.id],
            })
            .expect(200);

        assert.deepEqual(updateResponse.body, { data: {} });

        const updatedListResponse = await request(app.getHttpServer()).get('/roles').expect(200);
        const updatedRole = updatedListResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.id === role.id
        );

        assert.ok(updatedRole);
        assert.equal(updatedRole.name, updatedRoleName);
        assert.equal(updatedRole.description, '역할 수정 테스트');
        assert.deepEqual(
            updatedRole.permissions.map((permission: { id: number }) => permission.id),
            [readPermission.id]
        );
    } finally {
        await app.close();
    }
});

test('POST /roles returns 404 when a requested permission does not exist', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        await request(app.getHttpServer())
            .post('/roles')
            .send({
                name: `role.missing-permission.${Date.now()}`,
                description: '없는 권한 매핑 테스트',
                permissionIds: [999999],
            })
            .expect(404);
    } finally {
        await app.close();
    }
});

test('DELETE /roles/:roleId soft deletes a role and removes it from role list', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const roleName = `role.delete.${Date.now()}`;
        await request(app.getHttpServer())
            .post('/roles')
            .send({ name: roleName, description: '삭제 대상 역할' })
            .expect(201);

        const beforeListResponse = await request(app.getHttpServer()).get('/roles').expect(200);
        const role = beforeListResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === roleName
        );
        assert.ok(role);

        const deleteResponse = await request(app.getHttpServer()).delete(`/roles/${role.id}`).expect(200);

        assert.deepEqual(deleteResponse.body, { data: {} });

        const afterListResponse = await request(app.getHttpServer()).get('/roles').expect(200);
        const deletedRole = afterListResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.id === role.id
        );

        assert.equal(deletedRole, undefined);
    } finally {
        await app.close();
    }
});

test('DELETE /roles/:roleId returns 404 for a missing role', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        await request(app.getHttpServer()).delete('/roles/999999').expect(404);
    } finally {
        await app.close();
    }
});
