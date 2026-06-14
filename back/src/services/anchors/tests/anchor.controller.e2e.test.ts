import assert from 'node:assert/strict';
import test from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../app.module';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Anchor } from '../domain/anchor.entity';

test('POST /tracks/:trackId/anchors creates an anchor for a canvas-local timeline position', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `앵커 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `앵커 테스트 에피소드 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/products/${product.id}/episodes`)
            .send({
                episodeNumber: 1,
                title: episodeTitle,
            })
            .expect(201);

        const episodesResponse = await request(app.getHttpServer()).get(`/products/${product.id}/episodes`).expect(200);
        const episode = episodesResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === episodeTitle
        );
        assert.ok(episode);

        const trackName = `앵커 스크롤 트랙 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/tracks`)
            .send({
                name: trackName,
                type: 'scroll',
            })
            .expect(201);

        const tracksResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const track = tracksResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === trackName
        );
        assert.ok(track);

        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/canvases`)
            .send({
                medias: [],
            })
            .expect(201);

        const canvasesResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/canvases`).expect(200);
        const [canvas] = canvasesResponse.body.data.items as Array<{ id: number }>;
        assert.ok(canvas);

        const createResponse = await request(app.getHttpServer())
            .post(`/tracks/${track.id}/anchors`)
            .send({
                canvasId: canvas.id,
                time: 3200,
                position: 64.25,
                index: 2,
            })
            .expect(201);

        assert.deepEqual(createResponse.body, { data: {} });

        const dataSource = app.get(DataSource);
        const storedAnchor = await dataSource.manager.findOneByOrFail(Anchor, {
            trackId: track.id,
            canvasId: canvas.id,
        });

        assert.equal(storedAnchor.time, 3200);
        assert.equal(storedAnchor.position, 64.25);
        assert.equal(storedAnchor.index, 2);
    } finally {
        await app.close();
    }
});

test('PUT /tracks/:trackId/anchors/:anchorId updates an anchor for a canvas-local timeline position', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `앵커 수정 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `앵커 수정 테스트 에피소드 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/products/${product.id}/episodes`)
            .send({
                episodeNumber: 1,
                title: episodeTitle,
            })
            .expect(201);

        const episodesResponse = await request(app.getHttpServer()).get(`/products/${product.id}/episodes`).expect(200);
        const episode = episodesResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === episodeTitle
        );
        assert.ok(episode);

        const trackName = `앵커 수정 스크롤 트랙 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/tracks`)
            .send({
                name: trackName,
                type: 'scroll',
            })
            .expect(201);

        const tracksResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const track = tracksResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === trackName
        );
        assert.ok(track);

        await request(app.getHttpServer()).post(`/episodes/${episode.id}/canvases`).send({ medias: [] }).expect(201);
        await request(app.getHttpServer()).post(`/episodes/${episode.id}/canvases`).send({ medias: [] }).expect(201);

        const canvasesResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/canvases`).expect(200);
        const [initialCanvas, nextCanvas] = canvasesResponse.body.data.items as Array<{ id: number }>;
        assert.ok(initialCanvas);
        assert.ok(nextCanvas);

        await request(app.getHttpServer())
            .post(`/tracks/${track.id}/anchors`)
            .send({
                canvasId: initialCanvas.id,
                time: 3200,
                position: 64.25,
                index: 2,
            })
            .expect(201);

        const anchorsResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/anchors`).expect(200);
        const [anchor] = anchorsResponse.body.data.items as Array<{ id: number }>;
        assert.ok(anchor);

        const updateResponse = await request(app.getHttpServer())
            .put(`/tracks/${track.id}/anchors/${anchor.id}`)
            .send({
                canvasId: nextCanvas.id,
                time: 4500,
                position: 12.5,
                index: 1,
            })
            .expect(200);

        assert.deepEqual(updateResponse.body, { data: {} });

        const dataSource = app.get(DataSource);
        const storedAnchor = await dataSource.manager.findOneByOrFail(Anchor, {
            id: anchor.id,
        });

        assert.equal(storedAnchor.canvasId, nextCanvas.id);
        assert.equal(storedAnchor.time, 4500);
        assert.equal(storedAnchor.position, 12.5);
        assert.equal(storedAnchor.index, 1);

        await request(app.getHttpServer())
            .put(`/tracks/${track.id}/anchors/999999`)
            .send({
                position: 10,
            })
            .expect(404);
    } finally {
        await app.close();
    }
});

test('PUT /tracks/:trackId/anchors/:anchorId/event lets an anchor own a scroll or pause event', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `앵커 이벤트 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `앵커 이벤트 테스트 에피소드 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/products/${product.id}/episodes`)
            .send({
                episodeNumber: 1,
                title: episodeTitle,
            })
            .expect(201);

        const episodesResponse = await request(app.getHttpServer()).get(`/products/${product.id}/episodes`).expect(200);
        const episode = episodesResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === episodeTitle
        );
        assert.ok(episode);

        const trackName = `앵커 이벤트 스크롤 트랙 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/tracks`)
            .send({
                name: trackName,
                type: 'scroll',
            })
            .expect(201);

        const tracksResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const track = tracksResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === trackName
        );
        assert.ok(track);

        await request(app.getHttpServer()).post(`/episodes/${episode.id}/canvases`).send({ medias: [] }).expect(201);
        const canvasesResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/canvases`).expect(200);
        const [canvas] = canvasesResponse.body.data.items as Array<{ id: number }>;
        assert.ok(canvas);

        await request(app.getHttpServer())
            .post(`/tracks/${track.id}/anchors`)
            .send({ canvasId: canvas.id, time: 1000, position: 20, index: 0 })
            .expect(201);
        await request(app.getHttpServer())
            .post(`/tracks/${track.id}/anchors`)
            .send({ canvasId: canvas.id, time: 3000, position: 70, index: 1 })
            .expect(201);

        const anchorsResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/anchors`).expect(200);
        const startAnchor = anchorsResponse.body.data.items.find((item: { time: number }) => item.time === 1000);
        const endAnchor = anchorsResponse.body.data.items.find((item: { time: number }) => item.time === 3000);
        assert.ok(startAnchor);
        assert.ok(endAnchor);

        await request(app.getHttpServer())
            .put(`/tracks/${track.id}/anchors/${startAnchor.id}/event`)
            .send({
                type: 'scroll',
                endAnchorId: endAnchor.id,
            })
            .expect(200)
            .expect({ data: {} });

        const scrollEventAnchorsResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/anchors`).expect(200);
        const scrollOwner = scrollEventAnchorsResponse.body.data.items.find(
            (item: { id: number }) => item.id === startAnchor.id
        );

        assert.equal(scrollOwner.event.type, 'scroll');
        assert.equal(scrollOwner.event.startAnchorId, startAnchor.id);
        assert.equal(scrollOwner.event.endAnchorId, endAnchor.id);

        await request(app.getHttpServer())
            .put(`/tracks/${track.id}/anchors/${startAnchor.id}/event`)
            .send({
                type: 'pause',
                duration: 1800,
            })
            .expect(200)
            .expect({ data: {} });

        const pauseEventAnchorsResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/anchors`).expect(200);
        const pauseOwner = pauseEventAnchorsResponse.body.data.items.find(
            (item: { id: number }) => item.id === startAnchor.id
        );

        assert.equal(pauseOwner.event.type, 'pause');
        assert.equal(pauseOwner.event.duration, 1800);

        await request(app.getHttpServer())
            .delete(`/tracks/${track.id}/anchors/${startAnchor.id}/event`)
            .expect(200)
            .expect({ data: {} });

        const deletedEventAnchorsResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/anchors`).expect(200);
        const emptyOwner = deletedEventAnchorsResponse.body.data.items.find(
            (item: { id: number }) => item.id === startAnchor.id
        );

        assert.equal(emptyOwner.event, null);

        await request(app.getHttpServer())
            .put(`/tracks/${track.id}/anchors/${startAnchor.id}/event`)
            .send({
                type: 'scroll',
                endAnchorId: endAnchor.id,
            })
            .expect(200)
            .expect({ data: {} });

        await request(app.getHttpServer())
            .delete(`/tracks/${track.id}/anchors/${endAnchor.id}`)
            .expect(200)
            .expect({ data: {} });

        const anchorDeletedResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/anchors`).expect(200);
        const deletedAnchor = anchorDeletedResponse.body.data.items.find(
            (item: { id: number }) => item.id === endAnchor.id
        );
        const dataSource = app.get(DataSource);
        const storedDeletedAnchor = await dataSource.manager.findOne(Anchor, {
            where: { id: endAnchor.id },
            withDeleted: true,
        });
        const storedDeletedScroll = await dataSource.manager.findOne(Scroll, {
            where: { startAnchorId: startAnchor.id },
            withDeleted: true,
        });

        assert.equal(deletedAnchor, undefined);
        assert.ok(storedDeletedAnchor?.deletedAt);
        assert.ok(storedDeletedScroll?.deletedAt);
    } finally {
        await app.close();
    }
});
