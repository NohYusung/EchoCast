import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../app.module';

test('POST /tracks/:trackId/cues creates a cue and GET /episodes/:episodeId/tracks returns it', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `큐 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `큐 테스트 에피소드 ${Date.now()}`;
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

        const characterName = `큐 캐릭터 ${Date.now()}`;
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

        const trackName = `큐 보이스 트랙 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/tracks`)
            .send({
                name: trackName,
                type: 'record',
                characterId: character.id,
            })
            .expect(201);

        const tracksResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const track = tracksResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === trackName
        );
        assert.ok(track);

        const createResponse = await request(app.getHttpServer())
            .post(`/tracks/${track.id}/cues`)
            .send({
                script: 'API로 추가한 큐',
                volume: 0.85,
            })
            .expect(201);

        assert.deepEqual(createResponse.body, { data: {} });

        const cueListResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/cues`).expect(200);
        const listedCue = cueListResponse.body.data.items[0];

        assert.equal(cueListResponse.body.data.total, 1);
        assert.equal(listedCue.characterId, character.id);
        assert.equal(listedCue.trackId, track.id);
        assert.equal(listedCue.startTime, 0);
        assert.equal(listedCue.endTime, 1000);
        assert.equal(listedCue.startPosition, 0);
        assert.equal(listedCue.endPosition, 0);
        assert.equal(listedCue.volume, 0.85);
        assert.equal(listedCue.script, 'API로 추가한 큐');
        assert.equal(Object.hasOwn(listedCue, 'ttsVoiceId'), false);

        const listResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const updatedTrack = listResponse.body.data.items.find(
            (item: { id: number; cues: Array<{ startTime: number; endTime: number }> }) => item.id === track.id
        );
        assert.ok(updatedTrack);
        assert.equal(updatedTrack.cues.length, 1);
        assert.equal(updatedTrack.cues[0].characterId, character.id);
        assert.equal(updatedTrack.cues[0].trackId, track.id);
        assert.equal(updatedTrack.cues[0].startTime, 0);
        assert.equal(updatedTrack.cues[0].endTime, 1000);
        assert.equal(updatedTrack.cues[0].startPosition, 0);
        assert.equal(updatedTrack.cues[0].endPosition, 0);
        assert.equal(updatedTrack.cues[0].volume, 0.85);
        assert.equal(updatedTrack.cues[0].script, 'API로 추가한 큐');
        assert.equal(Object.hasOwn(updatedTrack.cues[0], 'ttsVoiceId'), false);

        const cueId = updatedTrack.cues[0].id;
        const updateResponse = await request(app.getHttpServer())
            .put(`/tracks/${track.id}/cues/${cueId}`)
            .send({
                script: 'API로 수정한 큐',
                startTime: 1800,
                endTime: 6000,
                startPosition: 18,
                endPosition: 72,
                volume: 0.65,
            })
            .expect(200);

        assert.deepEqual(updateResponse.body, { data: {} });

        const updatedListResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const trackWithUpdatedCue = updatedListResponse.body.data.items.find(
            (item: { id: number; cues: Array<{ id: number; script: string }> }) => item.id === track.id
        );
        assert.ok(trackWithUpdatedCue);
        assert.equal(trackWithUpdatedCue.cues.length, 1);
        assert.equal(trackWithUpdatedCue.cues[0].id, cueId);
        assert.equal(trackWithUpdatedCue.cues[0].script, 'API로 수정한 큐');
        assert.equal(trackWithUpdatedCue.cues[0].startTime, 1800);
        assert.equal(trackWithUpdatedCue.cues[0].endTime, 6000);
        assert.equal(trackWithUpdatedCue.cues[0].startPosition, 18);
        assert.equal(trackWithUpdatedCue.cues[0].endPosition, 72);
        assert.equal(trackWithUpdatedCue.cues[0].volume, 0.65);

        const deleteResponse = await request(app.getHttpServer())
            .delete(`/tracks/${track.id}/cues/${cueId}`)
            .expect(200);

        assert.deepEqual(deleteResponse.body, { data: {} });

        const deletedListResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const trackWithoutDeletedCue = deletedListResponse.body.data.items.find(
            (item: { id: number; cues: Array<{ id: number }> }) => item.id === track.id
        );
        assert.ok(trackWithoutDeletedCue);
        assert.equal(trackWithoutDeletedCue.cues.length, 0);
    } finally {
        await app.close();
    }
});
