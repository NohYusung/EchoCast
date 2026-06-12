import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';

test('GET /episodes/:episodeId/canvases does not treat standalone media as a canvas', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `캔버스 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `캔버스 테스트 에피소드 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/products/${product.id}/episodes`)
            .send({ episodeNumber: 1, title: episodeTitle })
            .expect(201);

        const episodesResponse = await request(app.getHttpServer()).get(`/products/${product.id}/episodes`).expect(200);
        const episode = episodesResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === episodeTitle
        );
        assert.ok(episode);

        const mediaUrl = `https://assets.example.com/canvas-${Date.now()}.png`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/medias`)
            .send({ mediaName: 'canvas.png', mediaType: 'image', mediaUrl, index: 0 })
            .expect(201);

        const listResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/canvases`).expect(200);
        const { items, total } = listResponse.body.data;

        assert.equal(total, 0);
        assert.deepEqual(items, []);
    } finally {
        await app.close();
    }
});

test('POST /episodes/:episodeId/canvases registers a canvas with media metadata', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `캔버스 등록 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `캔버스 등록 테스트 에피소드 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/products/${product.id}/episodes`)
            .send({ episodeNumber: 1, title: episodeTitle })
            .expect(201);

        const episodesResponse = await request(app.getHttpServer()).get(`/products/${product.id}/episodes`).expect(200);
        const episode = episodesResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === episodeTitle
        );
        assert.ok(episode);

        const mediaUrl = `https://assets.example.com/confirmed-canvas-${Date.now()}.png`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/medias`)
            .send({ mediaName: 'confirmed-canvas.png', mediaType: 'image', mediaUrl, index: 9 })
            .expect(201);

        const mediasResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/medias`).expect(200);
        const media = mediasResponse.body.data.items.find(
            (item: { id: number; mediaUrl: string }) => item.mediaUrl === mediaUrl
        );
        assert.ok(media);

        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/canvases`)
            .send({
                medias: [
                    {
                        mediaId: media.id,
                        index: 0,
                    },
                ],
            })
            .expect(201)
            .expect(({ body }) => {
                assert.deepEqual(body, { data: {} });
            });

        const listResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/canvases`).expect(200);
        const { items, total } = listResponse.body.data;

        assert.equal(total, 1);
        assert.equal(items.length, 1);
        assert.equal(items[0].episodeId, episode.id);
        assert.equal(items[0].mediaId, media.id);
        assert.equal(items[0].mediaName, 'confirmed-canvas.png');
        assert.equal(items[0].mediaType, 'image');
        assert.equal(items[0].mediaUrl, mediaUrl);
        assert.equal(items[0].index, 0);
        assert.deepEqual(items[0].medias, [
            {
                mediaId: media.id,
                mediaName: 'confirmed-canvas.png',
                mediaType: 'image',
                mediaUrl,
                index: 0,
            },
        ]);
        assert.equal(typeof items[0].id, 'number');
    } finally {
        await app.close();
    }
});
