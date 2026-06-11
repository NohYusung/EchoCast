import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';

test('DELETE /episodes/:episodeId/medias/:mediaId removes a registered media from the episode media list', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `미디어 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `미디어 테스트 에피소드 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/products/${product.id}/episodes`)
            .send({ episodeNumber: 1, title: episodeTitle })
            .expect(201);

        const episodesResponse = await request(app.getHttpServer()).get(`/products/${product.id}/episodes`).expect(200);
        const episode = episodesResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === episodeTitle
        );
        assert.ok(episode);

        const mediaUrl = `https://assets.example.com/media-${Date.now()}.png`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/medias`)
            .send({ mediaName: 'media.png', mediaType: 'image', mediaUrl, index: 0 })
            .expect(201);

        const beforeDeleteResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/medias`).expect(200);
        const media = beforeDeleteResponse.body.data.items.find(
            (item: { id: number; mediaName: string; mediaUrl: string }) => item.mediaUrl === mediaUrl
        );
        assert.ok(media);
        assert.equal(media.mediaName, 'media.png');

        const deleteResponse = await request(app.getHttpServer())
            .delete(`/episodes/${episode.id}/medias/${media.id}`)
            .expect(200);

        assert.deepEqual(deleteResponse.body, { data: {} });

        const afterDeleteResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/medias`).expect(200);

        assert.equal(afterDeleteResponse.body.data.total, 0);
        assert.deepEqual(afterDeleteResponse.body.data.items, []);
    } finally {
        await app.close();
    }
});

test('DELETE /episodes/:episodeId/medias/:mediaId returns 404 when the media is not registered in the episode', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        await request(app.getHttpServer()).delete('/episodes/9999/medias/9999').expect(404);
    } finally {
        await app.close();
    }
});
