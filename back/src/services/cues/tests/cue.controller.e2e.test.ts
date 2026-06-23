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
                duration: 2400,
                volume: 0.85,
            })
            .expect(201);

        assert.deepEqual(createResponse.body, { data: {} });

        const cueListResponse = await request(app.getHttpServer()).get(`/tracks/${track.id}/cues`).expect(200);
        const listedCue = cueListResponse.body.data.items[0];

        assert.equal(cueListResponse.body.data.total, 1);
        assert.equal(listedCue.characterId, character.id);
        assert.equal(listedCue.trackId, track.id);
        assert.equal(listedCue.startTime ?? undefined, undefined);
        assert.equal(listedCue.endTime ?? undefined, undefined);
        assert.equal(listedCue.startPosition, 0);
        assert.equal(listedCue.endPosition, 0);
        assert.equal(listedCue.volume, 0.85);
        assert.equal(listedCue.script, 'API로 추가한 큐');
        assert.equal(listedCue.duration, 2400);
        assert.equal(Object.hasOwn(listedCue, 'ttsVoiceId'), false);

        const listResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const updatedTrack = listResponse.body.data.items.find(
            (item: { id: number; cues: Array<{ startTime?: number; endTime?: number }> }) => item.id === track.id
        );
        assert.ok(updatedTrack);
        assert.equal(updatedTrack.cues.length, 1);
        assert.equal(updatedTrack.cues[0].characterId, character.id);
        assert.equal(updatedTrack.cues[0].trackId, track.id);
        assert.equal(updatedTrack.cues[0].startTime ?? undefined, undefined);
        assert.equal(updatedTrack.cues[0].endTime ?? undefined, undefined);
        assert.equal(updatedTrack.cues[0].startPosition, 0);
        assert.equal(updatedTrack.cues[0].endPosition, 0);
        assert.equal(updatedTrack.cues[0].volume, 0.85);
        assert.equal(updatedTrack.cues[0].script, 'API로 추가한 큐');
        assert.equal(updatedTrack.cues[0].duration, 2400);
        assert.equal(Object.hasOwn(updatedTrack.cues[0], 'ttsVoiceId'), false);

        const cueId = updatedTrack.cues[0].id;
        const updateResponse = await request(app.getHttpServer())
            .put(`/tracks/${track.id}/cues/${cueId}`)
            .send({
                script: 'API로 수정한 큐',
                duration: 1800,
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
        assert.equal(trackWithUpdatedCue.cues[0].duration, 1800);
        assert.equal(trackWithUpdatedCue.cues[0].startTime, 1800);
        assert.equal(trackWithUpdatedCue.cues[0].endTime, 6000);
        assert.equal(trackWithUpdatedCue.cues[0].startPosition, 18);
        assert.equal(trackWithUpdatedCue.cues[0].endPosition, 72);
        assert.equal(trackWithUpdatedCue.cues[0].volume, 0.65);

        const targetCharacterName = `큐 이동 캐릭터 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/products/${product.id}/characters`)
            .send({
                name: targetCharacterName,
                role: 'supporting',
            })
            .expect(201);

        const targetCharactersResponse = await request(app.getHttpServer())
            .get(`/products/${product.id}/characters`)
            .expect(200);
        const targetCharacter = targetCharactersResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === targetCharacterName
        );
        assert.ok(targetCharacter);

        const targetTrackName = `큐 이동 보이스 트랙 ${Date.now()}`;
        await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/tracks`)
            .send({
                name: targetTrackName,
                type: 'record',
                characterId: targetCharacter.id,
            })
            .expect(201);

        const targetTracksResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const targetTrack = targetTracksResponse.body.data.items.find(
            (item: { id: number; name: string }) => item.name === targetTrackName
        );
        assert.ok(targetTrack);

        const moveResponse = await request(app.getHttpServer())
            .put(`/tracks/${track.id}/cues/${cueId}`)
            .send({
                targetTrackId: targetTrack.id,
                script: 'API로 이동한 큐',
                duration: 2100,
                startTime: 2000,
                endTime: 7000,
                startPosition: 44,
                endPosition: 44,
            })
            .expect(200);

        assert.deepEqual(moveResponse.body, { data: {} });

        const movedListResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const sourceTrackAfterMove = movedListResponse.body.data.items.find(
            (item: { id: number; cues: Array<{ id: number }> }) => item.id === track.id
        );
        const targetTrackWithMovedCue = movedListResponse.body.data.items.find(
            (item: {
                id: number;
                cues: Array<{
                    id: number;
                    trackId: number;
                    characterId: number;
                    script: string;
                    duration: number;
                    startTime: number;
                    endTime: number;
                    startPosition: number;
                    endPosition: number;
                }>;
            }) => item.id === targetTrack.id
        );
        assert.ok(sourceTrackAfterMove);
        assert.ok(targetTrackWithMovedCue);
        assert.equal(sourceTrackAfterMove.cues.length, 0);
        assert.equal(targetTrackWithMovedCue.cues.length, 1);
        assert.equal(targetTrackWithMovedCue.cues[0].id, cueId);
        assert.equal(targetTrackWithMovedCue.cues[0].trackId, targetTrack.id);
        assert.equal(targetTrackWithMovedCue.cues[0].characterId, targetCharacter.id);
        assert.equal(targetTrackWithMovedCue.cues[0].script, 'API로 이동한 큐');
        assert.equal(targetTrackWithMovedCue.cues[0].duration, 2100);
        assert.equal(targetTrackWithMovedCue.cues[0].startTime, 2000);
        assert.equal(targetTrackWithMovedCue.cues[0].endTime, 7000);
        assert.equal(targetTrackWithMovedCue.cues[0].startPosition, 44);
        assert.equal(targetTrackWithMovedCue.cues[0].endPosition, 44);

        const deleteResponse = await request(app.getHttpServer())
            .delete(`/tracks/${targetTrack.id}/cues/${cueId}`)
            .expect(200);

        assert.deepEqual(deleteResponse.body, { data: {} });

        const deletedListResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const trackWithoutDeletedCue = deletedListResponse.body.data.items.find(
            (item: { id: number; cues: Array<{ id: number }> }) => item.id === targetTrack.id
        );
        assert.ok(trackWithoutDeletedCue);
        assert.equal(trackWithoutDeletedCue.cues.length, 0);
    } finally {
        await app.close();
    }
});
