import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';

test('POST /products/:productId/episodes creates an episode and PUT /products/:productId/episodes/:episodeId updates it', async () => {
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
        const thumbnailImageUrl = 'https://assets.example.com/episodes/1-thumbnail.png';

        const createResponse = await request(app.getHttpServer())
            .post(`/products/${product.id}/episodes`)
            .send({
                episodeNumber: 1,
                title: episodeTitle,
                subTitle,
                thumbnailImageUrl,
            })
            .expect(201);

        assert.deepEqual(createResponse.body, { data: {} });

        const listResponse = await request(app.getHttpServer()).get(`/products/${product.id}/episodes`).expect(200);

        const episode = listResponse.body.data.items[0];
        assert.equal(typeof episode.id, 'number');
        assert.deepEqual(listResponse.body, {
            data: {
                items: [
                    {
                        id: episode.id,
                        productId: product.id,
                        episodeNumber: 1,
                        title: episodeTitle,
                        subTitle,
                        thumbnailImageUrl,
                        defaultCanvasId: null,
                    },
                ],
                total: 1,
            },
        });

        const retrieveResponse = await request(app.getHttpServer())
            .get(`/products/${product.id}/episodes/${episode.id}`)
            .expect(200);

        assert.deepEqual(retrieveResponse.body, {
            data: {
                id: episode.id,
                productId: product.id,
                episodeNumber: 1,
                title: episodeTitle,
                subTitle,
                thumbnailImageUrl,
                defaultCanvasId: null,
            },
        });

        const updatedTitle = `1화 - 변경 ${Date.now()}`;
        const updatedSubTitle = '수정된 테스트 부제';
        const updatedThumbnailImageUrl = 'https://assets.example.com/episodes/1-thumbnail-updated.png';

        const updateResponse = await request(app.getHttpServer())
            .put(`/products/${product.id}/episodes/${episode.id}`)
            .send({
                title: updatedTitle,
                subTitle: updatedSubTitle,
                thumbnailImageUrl: updatedThumbnailImageUrl,
            })
            .expect(200);

        assert.deepEqual(updateResponse.body, { data: {} });

        const updatedRetrieveResponse = await request(app.getHttpServer())
            .get(`/products/${product.id}/episodes/${episode.id}`)
            .expect(200);

        assert.deepEqual(updatedRetrieveResponse.body, {
            data: {
                id: episode.id,
                productId: product.id,
                episodeNumber: 1,
                title: updatedTitle,
                subTitle: updatedSubTitle,
                thumbnailImageUrl: updatedThumbnailImageUrl,
                defaultCanvasId: null,
            },
        });
    } finally {
        await app.close();
    }
});
