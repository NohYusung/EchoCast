import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../app.module';

test('POST /artists creates an artist and GET /artists returns items with total', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const name = `성우 ${Date.now()}`;

        const createResponse = await request(app.getHttpServer()).post('/artists').send({ name }).expect(201);

        assert.deepEqual(createResponse.body, { data: {} });

        const listResponse = await request(app.getHttpServer()).get('/artists').expect(200);
        const { items, total } = listResponse.body.data;

        assert.equal(total, 1);
        assert.equal(items.length, 1);
        assert.ok(items.some((item: { id: number; name: string }) => typeof item.id === 'number' && item.name === name));
    } finally {
        await app.close();
    }
});
