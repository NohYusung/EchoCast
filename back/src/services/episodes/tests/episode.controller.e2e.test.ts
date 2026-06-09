import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';

test('POST /products/:productId/episodes creates an episode and GET /products/:productId/episodes returns items with total', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `에피소드 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `1화 - 시작 ${Date.now()}`;
        const subTitle = '테스트 부제';

        const createResponse = await request(app.getHttpServer())
            .post(`/products/${product.id}/episodes`)
            .send({
                episodeNumber: 1,
                title: episodeTitle,
                subTitle,
            })
            .expect(201);

        assert.deepEqual(createResponse.body, { data: {} });

        const listResponse = await request(app.getHttpServer()).get(`/products/${product.id}/episodes`).expect(200);

        assert.deepEqual(listResponse.body, {
            data: {
                items: [
                    {
                        id: 1,
                        productId: product.id,
                        episodeNumber: 1,
                        title: episodeTitle,
                        subTitle,
                    },
                ],
                total: 1,
            },
        });
    } finally {
        await app.close();
    }
});
