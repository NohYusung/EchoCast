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
        const subtitle = '테스트 작품 부제목';
        const coverImageUrl = 'https://assets.example.com/test-product.png';

        const createResponse = await request(app.getHttpServer())
            .post('/products')
            .send({
                title,
                subtitle,
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
                (item: { id: number; title: string; subtitle?: string; coverImageUrl?: string }) =>
                    typeof item.id === 'number' &&
                    item.title === title &&
                    item.subtitle === subtitle &&
                    item.coverImageUrl === coverImageUrl
            )
        );

        const createdProduct = items.find((item: { id: number; title: string }) => item.title === title);
        assert.ok(createdProduct);

        const retrieveResponse = await request(app.getHttpServer()).get(`/products/${createdProduct.id}`).expect(200);

        assert.deepEqual(retrieveResponse.body, {
            data: {
                id: createdProduct.id,
                title,
                subtitle,
                coverImageUrl,
            },
        });
    } finally {
        await app.close();
    }
});

test('PUT /products/:productId updates product information', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const title = `수정 전 작품 ${Date.now()}`;
        await request(app.getHttpServer())
            .post('/products')
            .send({
                title,
                subtitle: '수정 전 부제목',
                coverImageUrl: 'https://assets.example.com/product-before.png',
            })
            .expect(201);

        const beforeListResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = beforeListResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === title
        );
        assert.ok(product);

        const updatedTitle = `수정 후 작품 ${Date.now()}`;
        const updatedSubtitle = '수정 후 부제목';
        const updatedCoverImageUrl = 'https://assets.example.com/product-after.png';
        const updateResponse = await request(app.getHttpServer())
            .put(`/products/${product.id}`)
            .send({
                title: updatedTitle,
                subtitle: updatedSubtitle,
                coverImageUrl: updatedCoverImageUrl,
            })
            .expect(200);

        assert.deepEqual(updateResponse.body, { data: {} });

        const afterListResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const updatedProduct = afterListResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.id === product.id
        );

        assert.ok(updatedProduct);
        assert.equal(updatedProduct.title, updatedTitle);
        assert.equal(updatedProduct.subtitle, updatedSubtitle);
        assert.equal(updatedProduct.coverImageUrl, updatedCoverImageUrl);
    } finally {
        await app.close();
    }
});
