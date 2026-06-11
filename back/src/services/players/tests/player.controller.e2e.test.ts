import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../app.module';
import { Artist } from '../../artists/domain/artist.entity';
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
        const media = await dataSource.manager.save(
            new Media({
                episodeId: episode.id,
                canvasId: canvas.id,
                mediaType: 'image',
                mediaUrl: 'https://assets.example.com/api-visual.png',
                index: 0,
            })
        );
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
        await dataSource.manager.save(
            new RecordEntity({
                cueId: cue.id,
                artistId: artist.id,
                status: 'approved',
                audioUrl: 'https://assets.example.com/api-record.wav',
                durationMs: 1700,
            })
        );

        const manifestResponse = await request(app.getHttpServer())
            .get(`/player/manifest/${episode.id}`)
            .expect(200);

        assert.equal(manifestResponse.body.data.episodeId, String(episode.id));
        assert.equal(manifestResponse.body.data.records[0].cueId, String(cue.id));
        assert.equal(manifestResponse.body.data.cues[0].approvedRecordUrl, 'https://assets.example.com/api-record.wav');

        await request(app.getHttpServer()).get(`/episodes/${episode.id}/player-draft`).expect(404);
        await request(app.getHttpServer()).put(`/episodes/${episode.id}/player-draft`).send({}).expect(404);
    } finally {
        await app.close();
    }
});
