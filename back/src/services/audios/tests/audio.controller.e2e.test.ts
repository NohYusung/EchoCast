import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../app.module';

test('POST /episodes/:episodeId/audios creates audio and GET /episodes/:episodeId/audios returns items with total', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const productTitle = `오디오 테스트 작품 ${Date.now()}`;
        await request(app.getHttpServer()).post('/products').send({ title: productTitle }).expect(201);

        const productsResponse = await request(app.getHttpServer()).get('/products').expect(200);
        const product = productsResponse.body.data.items.find(
            (item: { id: number; title: string }) => item.title === productTitle
        );
        assert.ok(product);

        const episodeTitle = `오디오 테스트 에피소드 ${Date.now()}`;
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

        const audioUrl = `https://assets.example.com/audios/impact-${Date.now()}.wav`;
        const createResponse = await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/audios`)
            .send({
                audioType: 'effect',
                name: 'impact.wav',
                audioUrl,
                duration: 3000,
            })
            .expect(201);

        assert.deepEqual(createResponse.body, { data: {} });

        const initialListResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/audios`).expect(200);
        const initialAudio = initialListResponse.body.data.items.find(
            (item: { id: number; audioUrl: string; cueId?: number }) => item.audioUrl === audioUrl
        );
        assert.ok(initialAudio);
        assert.equal(initialAudio.cueId, undefined);

        const dropResponse = await request(app.getHttpServer())
            .post(`/episodes/${episode.id}/audios/${initialAudio.id}/drop-to-track`)
            .send({
                trackName: 'Impact SFX',
                trackType: 'effect',
                startTime: 1200,
                volume: 0.7,
            })
            .expect(201);

        assert.equal(dropResponse.body.data.track.name, 'Impact SFX');
        assert.equal(dropResponse.body.data.track.type, 'effect');
        assert.equal(dropResponse.body.data.cue.audioId, initialAudio.id);
        assert.equal(dropResponse.body.data.cue.startTime, 1200);
        assert.equal(dropResponse.body.data.cue.endTime, 4200);

        const listResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/audios`).expect(200);
        const { items, total } = listResponse.body.data;

        assert.equal(total, 1);
        assert.equal(items.length, 1);
        assert.ok(
            items.some(
                (item: {
                    id: number;
                    episodeId: number;
                    cueId: number;
                    audioType: string;
                    name: string;
                    audioUrl: string;
                    duration: number;
                }) =>
                    typeof item.id === 'number' &&
                    item.episodeId === episode.id &&
                    item.cueId === dropResponse.body.data.cue.id &&
                    item.audioType === 'effect' &&
                    item.name === 'impact.wav' &&
                    item.audioUrl === audioUrl &&
                    item.duration === 3000
            )
        );

        const tracksResponse = await request(app.getHttpServer()).get(`/episodes/${episode.id}/tracks`).expect(200);
        const track = tracksResponse.body.data.items.find(
            (item: { id: number; name: string; cues: Array<{ audioId?: number }> }) =>
                item.name === 'Impact SFX' && item.cues.some((cue) => cue.audioId === initialAudio.id)
        );
        assert.ok(track);
    } finally {
        await app.close();
    }
});
