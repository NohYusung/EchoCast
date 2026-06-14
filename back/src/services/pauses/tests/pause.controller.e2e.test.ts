import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';

test('POST /tracks/:trackId/pauses creates a pause event and GET /tracks/:trackId/pauses returns items with total', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `정지 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `정지 테스트 에피소드 ${Date.now()}`;
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

        const trackName = `정지 트랙 ${Date.now()}`;
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
                time: 1200,
                position: 32,
                index: 0,
            })
            .expect(201)
            .expect({ data: {} });

        const anchorsResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/anchors`).expect(200);
        const anchor = anchorsResponse.body.data.items.find(
            (item: { time: number; position: number }) => item.time === 1200 && item.position === 32
        );
        assert.ok(anchor);

        await request(app.getHttpServer())
            .post(`/tracks/${track.id}/pauses`)
            .send({
                anchorId: anchor.id,
                duration: 1800,
            })
            .expect(201)
            .expect({ data: {} });

        const listResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/pauses`).expect(200);
        const { items, total } = listResponse.body.data;

        assert.equal(total, 1);
        assert.deepEqual(items, [
            {
                id: items[0].id,
                trackId: track.id,
                anchorId: anchor.id,
                duration: 1800,
                canvasId: canvas.id,
                index: 0,
                time: 1200,
                position: 32,
            },
        ]);

        await request(app.getHttpServer())
            .put(`/tracks/${track.id}/pauses/${items[0].id}`)
            .send({
                duration: 2400,
            })
            .expect(200)
            .expect({ data: {} });

        const updatedListResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/pauses`).expect(200);
        assert.equal(updatedListResponse.body.data.items[0].duration, 2400);

        await request(app.getHttpServer())
            .delete(`/tracks/${track.id}/pauses/${items[0].id}`)
            .expect(200)
            .expect({ data: {} });

        const deletedListResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/pauses`).expect(200);
        assert.deepEqual(deletedListResponse.body.data, { items: [], total: 0 });
    } finally {
        await app.close();
    }
});
