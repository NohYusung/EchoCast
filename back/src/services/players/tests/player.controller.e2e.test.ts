import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../app.module';
import { Artist } from '../../artists/domain/artist.entity';
import { Audio } from '../../audios/domain/audio.entity';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Character } from '../../characters/domain/character.entity';
import { Cue } from '../../cues/domain/cue.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Media } from '../../medias/domain/media.entity';
import { Product } from '../../products/domain/product.entity';
import { Record as RecordEntity } from '../../records/domain/record.entity';
import { Track } from '../../tracks/domain/track.entity';

test('GET player manifest endpoint exposes episode playback content without draft APIs', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const dataSource = app.get(DataSource);
        const product = await dataSource.manager.save(new Product({ title: 'Player API product' }));
        const episode = await dataSource.manager.save(
            new Episode({
                productId: product.id,
                episodeNumber: 1,
                title: 'Player API episode',
            })
        );
        const character = await dataSource.manager.save(
            new Character({
                productId: product.id,
                name: '나리',
            })
        );
        const track = await dataSource.manager.save(
            new Track({
                episodeId: episode.id,
                name: 'Dialogue',
                type: 'record',
            })
        );
        const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
        episode.defaultCanvasId = canvas.id;
        await dataSource.manager.save(episode);
        const media = await dataSource.manager.save(
            new Media({
                episodeId: episode.id,
                mediaName: 'api-visual.png',
                mediaType: 'image',
                mediaUrl: 'https://assets.example.com/api-visual.png',
            })
        );
        await dataSource.manager.save(new CanvasMedia({ canvasId: canvas.id, mediaId: media.id, index: 0 }));
        const cue = await dataSource.manager.save(
            new Cue({
                script: 'API 대사',
                characterId: character.id,
                trackId: track.id,
                startTime: 0,
                endTime: 1800,
            })
        );
        const artist = await dataSource.manager.save(new Artist({ name: 'API 성우' }));
        const recordAudio = await dataSource.manager.save(
            new Audio({
                episodeId: episode.id,
                audioType: 'record',
                name: 'api-record.wav',
                audioUrl: 'https://assets.example.com/api-record.wav',
                duration: 1700,
            })
        );
        await dataSource.manager.save(
            new RecordEntity({
                cueId: cue.id,
                artistId: artist.id,
                audioId: recordAudio.id,
                isAccepted: true,
            })
        );
        cue.update({ audioId: recordAudio.id });
        await dataSource.manager.save(cue);

        const manifestResponse = await request(app.getHttpServer()).get(`/player/manifest/${episode.id}`).expect(200);

        assert.equal(manifestResponse.body.data.episodeId, episode.id);
        assert.equal(manifestResponse.body.data.records[0].cueId, cue.id);
        assert.equal(manifestResponse.body.data.records[0].recordUrl, 'https://assets.example.com/api-record.wav');
        assert.equal(manifestResponse.body.data.records[0].isAccepted, true);
        assert.equal(manifestResponse.body.data.cues[0].approvedRecordUrl, 'https://assets.example.com/api-record.wav');

        await request(app.getHttpServer()).get(`/player/manifest/${episode.id}?canvasId=1abc`).expect(400);
        await request(app.getHttpServer()).get(`/episodes/${episode.id}/player-draft`).expect(404);
        await request(app.getHttpServer()).put(`/episodes/${episode.id}/player-draft`).send({}).expect(404);
    } finally {
        await app.close();
    }
});

test('GET player manifest endpoint rejects playback before a default canvas exists', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const dataSource = app.get(DataSource);
        const product = await dataSource.manager.save(new Product({ title: 'Fresh API product' }));
        const episode = await dataSource.manager.save(
            new Episode({
                productId: product.id,
                episodeNumber: 1,
                title: 'Fresh API episode',
            })
        );

        await request(app.getHttpServer()).get(`/player/manifest/${episode.id}`).expect(404);
    } finally {
        await app.close();
    }
});
