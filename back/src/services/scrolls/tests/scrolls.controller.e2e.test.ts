import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';

test('POST /tracks/:trackId/scrolls creates a scroll event and GET /tracks/:trackId/scrolls returns items with total', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `스크롤 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `스크롤 테스트 에피소드 ${Date.now()}`;
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

        const trackName = `스크롤 트랙 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/tracks`)
            .send({
                name: trackName,
                type: 'scroll',
            })
            .expect((response) => assert.ok([200, 201].includes(response.status)));

        const tracksResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const track = tracksResponse.body.data.items.find(
            (item: { id: number; name: string; type: string }) => item.name === trackName && item.type === 'scroll'
        );
        assert.ok(track);

        await request(app.getHttpServer()).post(`/episodes/${episode.id}/canvases`).send({ medias: [] }).expect(201);
        const canvasesResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/canvases`).expect(200);
        const canvas = canvasesResponse.body.data.items[0];
        assert.ok(canvas);

        await request(app.getHttpServer())
            .post(`/tracks/${track.id}/anchors`)
            .send({
                canvasId: canvas.id,
                time: 1000,
                position: 12,
                index: 0,
            })
            .expect(201)
            .expect({ data: {} });
        await request(app.getHttpServer())
            .post(`/tracks/${track.id}/anchors`)
            .send({
                canvasId: canvas.id,
                time: 5000,
                position: 84,
                index: 0,
            })
            .expect(201)
            .expect({ data: {} });
        const anchorsResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/anchors`).expect(200);
        const startAnchor = anchorsResponse.body.data.items.find(
            (item: { time: number; position: number }) => item.time === 1000 && item.position === 12
        );
        const endAnchor = anchorsResponse.body.data.items.find(
            (item: { time: number; position: number }) => item.time === 5000 && item.position === 84
        );
        assert.ok(startAnchor);
        assert.ok(endAnchor);

        const createResponse = await request(app.getHttpServer())
            .post(`/tracks/${track.id}/scrolls`)
            .send({
                startAnchorId: startAnchor.id,
                endAnchorId: endAnchor.id,
            })
            .expect(201);

        assert.deepEqual(createResponse.body, { data: {} });

        const listResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/scrolls`).expect(200);
        const { items, total } = listResponse.body.data;

        assert.equal(total, 1);
        assert.equal(typeof items[0].startAnchorId, 'number');
        assert.equal(typeof items[0].endAnchorId, 'number');
        assert.deepEqual(items, [
            {
                id: items[0].id,
                trackId: track.id,
                startAnchorId: startAnchor.id,
                endAnchorId: endAnchor.id,
                canvasId: canvas.id,
                startIndex: 0,
                endIndex: 0,
                startTime: 1000,
                endTime: 5000,
                startPosition: 12,
                endPosition: 84,
            },
        ]);
        assert.equal(typeof items[0].id, 'number');

        await request(app.getHttpServer())
            .post(`/tracks/${track.id}/anchors`)
            .send({
                canvasId: canvas.id,
                time: 2000,
                position: 20,
                index: 1,
            })
            .expect(201)
            .expect({ data: {} });
        await request(app.getHttpServer())
            .post(`/tracks/${track.id}/anchors`)
            .send({
                canvasId: canvas.id,
                time: 7000,
                position: 90,
                index: 2,
            })
            .expect(201)
            .expect({ data: {} });
        const updatedAnchorsResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/anchors`).expect(200);
        const updatedStartAnchor = updatedAnchorsResponse.body.data.items.find(
            (item: { time: number; position: number }) => item.time === 2000 && item.position === 20
        );
        const updatedEndAnchor = updatedAnchorsResponse.body.data.items.find(
            (item: { time: number; position: number }) => item.time === 7000 && item.position === 90
        );
        assert.ok(updatedStartAnchor);
        assert.ok(updatedEndAnchor);

        await request(app.getHttpServer())
            .put(`/tracks/${track.id}/scrolls/${items[0].id}`)
            .send({
                startAnchorId: updatedStartAnchor.id,
                endAnchorId: updatedEndAnchor.id,
            })
            .expect(200)
            .expect({ data: {} });

        const updatedListResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/scrolls`).expect(200);
        assert.deepEqual(updatedListResponse.body.data.items, [
            {
                id: items[0].id,
                trackId: track.id,
                startAnchorId: updatedStartAnchor.id,
                endAnchorId: updatedEndAnchor.id,
                canvasId: canvas.id,
                startIndex: 1,
                endIndex: 2,
                startTime: 2000,
                endTime: 7000,
                startPosition: 20,
                endPosition: 90,
            },
        ]);

        await request(app.getHttpServer())
            .delete(`/tracks/${track.id}/scrolls/${items[0].id}`)
            .expect(200)
            .expect({ data: {} });

        const deletedListResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/scrolls`).expect(200);
        assert.deepEqual(deletedListResponse.body.data, { items: [], total: 0 });
        const anchorsAfterScrollDeleteResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/anchors`).expect(200);
        assert.equal(anchorsAfterScrollDeleteResponse.body.data.total, 4);
    } finally {
        await app.close();
    }
});
