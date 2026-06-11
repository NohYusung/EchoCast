import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';

test('POST /episodes/:episodeId/tracks creates a character-linked track and GET /episodes/:episodeId/tracks returns items with total', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `트랙 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `트랙 테스트 에피소드 ${Date.now()}`;
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

        const characterName = `트랙 캐릭터 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/products/${product.id}/characters`)
            .send({
                name: characterName,
                role: 'starring',
            })
            .expect(201);

        const charactersResponse = await request(app.getHttpServer())
            .get(`/products/${product.id}/characters`)
            .expect(200);
        const character = charactersResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === characterName
        );
        assert.ok(character);

        const trackName = `나리 대사 트랙 ${Date.now()}`;
        const createResponse = await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/tracks`)
            .send({
                name: trackName,
                type: 'record',
                isMuted: true,
                characterId: character.id,
            })
            .expect(201);

        assert.deepEqual(createResponse.body, { data: {} });

        const listResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const { items, total } = listResponse.body.data;

        assert.equal(total, 1);
        assert.equal(items.length, 1);
        assert.ok(
            items.some(
                (item: { id: number; episodeId: number; name: string; type: string; isMuted: boolean; characterId: number }) =>
                    typeof item.id === 'number' &&
                    item.episodeId === episode.id &&
                    item.name === trackName &&
                    item.type === 'record' &&
                    item.isMuted === true &&
                    item.characterId === character.id
            )
        );
    } finally {
        await app.close();
    }
});
