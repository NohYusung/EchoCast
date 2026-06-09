import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';

test('POST /products/:productId/characters creates a character', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const response = await request(app.getHttpServer())
            .post('/products/product-1/characters')
            .send({ name: '나리', role: 'starring' })
            .expect(201);

        assert.deepEqual(response.body, { data: {} });
    } finally {
        await app.close();
    }
});
