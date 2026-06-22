import assert from 'node:assert/strict';
import test from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app.module';

test('POST /permissions creates a permission and GET /permissions returns items with total', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const beforeListResponse = await request(app.getHttpServer()).get('/permissions').expect(200);
        const beforeTotal = beforeListResponse.body.data.total;
        const name = `permission.create.${Date.now()}`;
        const description = '권한 생성 테스트';

        const createResponse = await request(app.getHttpServer())
            .post('/permissions')
            .send({ name, description })
            .expect(201);

        assert.deepEqual(createResponse.body, { data: {} });

        const listResponse = await request(app.getHttpServer()).get('/permissions').expect(200);
        const { items, total } = listResponse.body.data;

        assert.equal(total, beforeTotal + 1);
        assert.equal(items.length, total);
        assert.ok(
            items.some(
                (item: { id: number; name: string; description: string }) =>
                    typeof item.id === 'number' && item.name === name && item.description === description
            )
        );
    } finally {
        await app.close();
    }
});

test('PUT /permissions/:permissionId updates permission information', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const name = `permission.before.${Date.now()}`;
        await request(app.getHttpServer())
            .post('/permissions')
            .send({ name, description: '수정 전 권한' })
            .expect(201);

        const beforeListResponse = await request(app.getHttpServer()).get('/permissions').expect(200);
        const permission = beforeListResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === name
        );
        assert.ok(permission);

        const updatedName = `permission.after.${Date.now()}`;
        const updatedDescription = '수정 후 권한';
        const updateResponse = await request(app.getHttpServer())
            .put(`/permissions/${permission.id}`)
            .send({ name: updatedName, description: updatedDescription })
            .expect(200);

        assert.deepEqual(updateResponse.body, { data: {} });

        const afterListResponse = await request(app.getHttpServer()).get('/permissions').expect(200);
        const updatedPermission = afterListResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.id === permission.id
        );

        assert.ok(updatedPermission);
        assert.equal(updatedPermission.name, updatedName);
        assert.equal(updatedPermission.description, updatedDescription);
    } finally {
        await app.close();
    }
});

test('DELETE /permissions/:permissionId soft deletes a permission and removes it from permission list', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const name = `permission.delete.${Date.now()}`;
        await request(app.getHttpServer())
            .post('/permissions')
            .send({ name, description: '삭제 대상 권한' })
            .expect(201);

        const beforeListResponse = await request(app.getHttpServer()).get('/permissions').expect(200);
        const permission = beforeListResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === name
        );
        assert.ok(permission);

        const deleteResponse = await request(app.getHttpServer()).delete(`/permissions/${permission.id}`).expect(200);

        assert.deepEqual(deleteResponse.body, { data: {} });

        const afterListResponse = await request(app.getHttpServer()).get('/permissions').expect(200);
        const deletedPermission = afterListResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.id === permission.id
        );

        assert.equal(deletedPermission, undefined);
    } finally {
        await app.close();
    }
});

test('DELETE /permissions/:permissionId returns 404 for a missing permission', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        await request(app.getHttpServer()).delete('/permissions/999999').expect(404);
    } finally {
        await app.close();
    }
});
