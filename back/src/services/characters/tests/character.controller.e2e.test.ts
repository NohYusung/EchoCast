import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';

test('POST /products/:productId/characters creates a character and GET /products/:productId/characters returns items with total', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `캐릭터 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const name = '나리';
        const role = 'starring';
        const imageUrl = 'https://cdn.example.com/characters/nari.png';

        const response = await request(app.getHttpServer())
            .post(`/products/${product.id}/characters`)
            .send({ name, role, imageUrl })
            .expect(201);

        assert.deepEqual(response.body, { data: {} });

        const listResponse = await request(app.getHttpServer()).get(`/products/${product.id}/characters`).expect(200);
        const { items, total } = listResponse.body.data;

        assert.equal(total, 1);
        assert.equal(items.length, 1);
        assert.ok(
            items.some(
                (item: { id: number; productId: number; name: string; role: string; imageUrl?: string }) =>
                    typeof item.id === 'number' &&
                    item.productId === product.id &&
                    item.name === name &&
                    item.role === role &&
                    item.imageUrl === imageUrl
            )
        );
    } finally {
        await app.close();
    }
});

test('DELETE /products/:productId/characters/:characterId removes a character from the product list', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `캐릭터 삭제 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        await request(app.getHttpServer())
            .post(`/products/${product.id}/characters`)
            .send({ name: '삭제 대상', role: 'supporting' })
            .expect(201);

        const beforeDeleteResponse = await request(app.getHttpServer())
            .get(`/products/${product.id}/characters`)
            .expect(200);
        const character = beforeDeleteResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === '삭제 대상'
        );
        assert.ok(character);

        const deleteResponse = await request(app.getHttpServer())
            .delete(`/products/${product.id}/characters/${character.id}`)
            .expect(200);

        assert.deepEqual(deleteResponse.body, { data: {} });

        const afterDeleteResponse = await request(app.getHttpServer())
            .get(`/products/${product.id}/characters`)
            .expect(200);

        assert.equal(afterDeleteResponse.body.data.total, 0);
        assert.deepEqual(afterDeleteResponse.body.data.items, []);
    } finally {
        await app.close();
    }
});

test('DELETE /products/:productId/characters/:characterId returns 404 when the character is not registered in the product', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        await request(app.getHttpServer()).delete('/products/9999/characters/9999').expect(404);
    } finally {
        await app.close();
    }
});
