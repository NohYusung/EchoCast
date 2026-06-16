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
            .send({ mediaName: 'canvas.png', mediaType: 'image', mediaUrl })
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
            .send({ mediaName: 'confirmed-canvas.png', mediaType: 'image', mediaUrl })
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
        assert.equal(typeof items[0].canvasMediaId, 'number');
        assert.equal(items[0].index, 0);
        assert.deepEqual(items[0].medias, [
            {
                canvasMediaId: items[0].medias[0].canvasMediaId,
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

test('POST /episodes/:episodeId/canvases keeps canvas media indexes independent for shared media', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `캔버스 다중 연결 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `캔버스 다중 연결 테스트 에피소드 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/products/${product.id}/episodes`)
            .send({ episodeNumber: 1, title: episodeTitle })
            .expect(201);

        const episodesResponse = await request(app.getHttpServer()).get(`/products/${product.id}/episodes`).expect(200);
        const episode = episodesResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === episodeTitle
        );
        assert.ok(episode);

        const mediaUrl = `https://assets.example.com/shared-canvas-${Date.now()}.png`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/medias`)
            .send({ mediaName: 'shared-canvas.png', mediaType: 'image', mediaUrl })
            .expect(201);

        const mediasResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/medias`).expect(200);
        const media = mediasResponse.body.data.items.find(
            (item: { id: number; mediaUrl: string }) => item.mediaUrl === mediaUrl
        );
        assert.ok(media);

        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/canvases`)
            .send({ medias: [{ mediaId: media.id, index: 0 }] })
            .expect(201);
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/canvases`)
            .send({ medias: [{ mediaId: media.id, index: 3 }] })
            .expect(201);

        const listResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/canvases`).expect(200);
        const { items, total } = listResponse.body.data;

        assert.equal(total, 2);
        assert.deepEqual(
            items.map((item: { medias: Array<{ mediaId: number }> }) =>
                item.medias.map((mediaItem: { mediaId: number; index: number }) => ({
                    mediaId: mediaItem.mediaId,
                    index: mediaItem.index,
                }))
            ),
            [
                [{ mediaId: media.id, index: 0 }],
                [{ mediaId: media.id, index: 3 }],
            ]
        );
    } finally {
        await app.close();
    }
});

test('PUT /episodes/:episodeId/canvases/:canvasId replaces attached media items', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `캔버스 수정 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `캔버스 수정 테스트 에피소드 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/products/${product.id}/episodes`)
            .send({ episodeNumber: 1, title: episodeTitle })
            .expect(201);

        const episodesResponse = await request(app.getHttpServer()).get(`/products/${product.id}/episodes`).expect(200);
        const episode = episodesResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === episodeTitle
        );
        assert.ok(episode);

        const firstMediaUrl = `https://assets.example.com/update-first-${Date.now()}.png`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/medias`)
            .send({ mediaName: 'update-first.png', mediaType: 'image', mediaUrl: firstMediaUrl })
            .expect(201);
        const secondMediaUrl = `https://assets.example.com/update-second-${Date.now()}.png`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/medias`)
            .send({ mediaName: 'update-second.png', mediaType: 'image', mediaUrl: secondMediaUrl })
            .expect(201);

        const mediasResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/medias`).expect(200);
        const firstMedia = mediasResponse.body.data.items.find(
            (item: { id: number; mediaUrl: string }) => item.mediaUrl === firstMediaUrl
        );
        const secondMedia = mediasResponse.body.data.items.find(
            (item: { id: number; mediaUrl: string }) => item.mediaUrl === secondMediaUrl
        );
        assert.ok(firstMedia);
        assert.ok(secondMedia);

        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/canvases`)
            .send({ medias: [{ mediaId: firstMedia.id, index: 0 }] })
            .expect(201);

        const beforeListResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/canvases`).expect(200);
        const canvas = beforeListResponse.body.data.items[0];
        assert.ok(canvas);
        const initialCanvasMediaId = canvas.medias[0].canvasMediaId;

        await request(app.getHttpServer())
            .put(`/episodes/${episode.id}/canvases/${canvas.id}`)
            .send({
                medias: [
                    { mediaId: secondMedia.id, index: 0 },
                    { mediaId: firstMedia.id, index: 1 },
                ],
            })
            .expect(200)
            .expect(({ body }) => {
                assert.deepEqual(body, { data: {} });
            });

        const afterListResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/canvases`).expect(200);
        const { items, total } = afterListResponse.body.data;

        assert.equal(total, 1);
        assert.equal(typeof items[0].medias[0].canvasMediaId, 'number');
        assert.equal(typeof items[0].medias[1].canvasMediaId, 'number');
        assert.deepEqual(items[0].medias, [
            {
                canvasMediaId: items[0].medias[0].canvasMediaId,
                mediaId: secondMedia.id,
                mediaName: 'update-second.png',
                mediaType: 'image',
                mediaUrl: secondMediaUrl,
                index: 0,
            },
            {
                canvasMediaId: items[0].medias[1].canvasMediaId,
                mediaId: firstMedia.id,
                mediaName: 'update-first.png',
                mediaType: 'image',
                mediaUrl: firstMediaUrl,
                index: 1,
            },
        ]);
        assert.equal(items[0].medias[1].canvasMediaId, initialCanvasMediaId);
    } finally {
        await app.close();
    }
});

test('PUT /episodes/:episodeId/canvases/:canvasId persists video timeline controls', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `캔버스 비디오 타임라인 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `캔버스 비디오 타임라인 테스트 에피소드 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/products/${product.id}/episodes`)
            .send({ episodeNumber: 1, title: episodeTitle })
            .expect(201);

        const episodesResponse = await request(app.getHttpServer()).get(`/products/${product.id}/episodes`).expect(200);
        const episode = episodesResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === episodeTitle
        );
        assert.ok(episode);

        const mediaUrl = `https://assets.example.com/timeline-video-${Date.now()}.mp4`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/medias`)
            .send({ mediaName: 'timeline-video.mp4', mediaType: 'video', mediaUrl, duration: 12000 })
            .expect(201);

        const mediasResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/medias`).expect(200);
        const media = mediasResponse.body.data.items.find(
            (item: { id: number; mediaUrl: string }) => item.mediaUrl === mediaUrl
        );
        assert.ok(media);

        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/canvases`)
            .send({ medias: [{ mediaId: media.id, index: 0 }] })
            .expect(201);

        const beforeListResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/canvases`).expect(200);
        const canvas = beforeListResponse.body.data.items[0];
        assert.ok(canvas);

        await request(app.getHttpServer())
            .put(`/episodes/${episode.id}/canvases/${canvas.id}`)
            .send({
                medias: [
                    {
                        mediaId: media.id,
                        index: 0,
                        startTime: 2000,
                        endTime: 9000,
                        sourceStartTime: 1000,
                        sourceEndTime: 8000,
                        volume: 0.55,
                        isMuted: true,
                    },
                ],
            })
            .expect(200);

        const afterListResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/canvases`).expect(200);
        const { items, total } = afterListResponse.body.data;

        assert.equal(total, 1);
        assert.deepEqual(items[0].medias, [
            {
                canvasMediaId: items[0].medias[0].canvasMediaId,
                mediaId: media.id,
                mediaName: 'timeline-video.mp4',
                mediaType: 'video',
                mediaUrl,
                duration: 12000,
                index: 0,
                startTime: 2000,
                endTime: 9000,
                sourceStartTime: 1000,
                sourceEndTime: 8000,
                volume: 0.55,
                isMuted: true,
            },
        ]);
    } finally {
        await app.close();
    }
});
