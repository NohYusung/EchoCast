import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';

test('POST /products creates a product and GET /products returns items with total', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const beforeListResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const beforeTotal = beforeListResponse.body.data.total;
        const title = `테스트 작품 ${Date.now()}`;
        const coverImageUrl = 'https://assets.example.com/test-product.png';

        const createResponse = await request(app.getHttpServer())
            .post('/products')
            .send({
                title,
                coverImageUrl,
            })
            .expect(201);

        assert.deepEqual(createResponse.body, { data: {} });

        const listResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const { items, total } = listResponse.body.data;

        assert.equal(total, beforeTotal + 1);
        assert.equal(items.length, total);
        assert.ok(
            items.some(
                (item: { id: number; title: string; coverImageUrl?: string }) =>
                    typeof item.id === 'number' && item.title === title && item.coverImageUrl === coverImageUrl
            )
        );
    } finally {
        await app.close();
    }
});
