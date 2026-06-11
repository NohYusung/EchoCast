import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../app.module';
import { Artist } from '../../artists/domain/artist.entity';
import { Character } from '../../characters/domain/character.entity';
import { Cue } from '../../cues/domain/cue.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Product } from '../../products/domain/product.entity';
import { Track } from '../../tracks/domain/track.entity';
import { Record } from '../domain/record.entity';

test('POST /records creates a record for a cue and artist', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const dataSource = app.get(DataSource);
        const product = await dataSource.manager.save(new Product({ title: 'Record API product' }));
        const character = await dataSource.manager.save(
            new Character({
                productId: product.id,
                name: 'Record API character',
            })
        );
        const episode = await dataSource.manager.save(
            new Episode({
                productId: product.id,
                episodeNumber: 1,
                title: 'Record API episode',
            })
        );
        const track = await dataSource.manager.save(
            new Track({
                episodeId: episode.id,
                name: 'Record API track',
                type: 'record',
                characterId: character.id,
            })
        );
        const cue = await dataSource.manager.save(
            new Cue({
                script: 'Record API script',
                characterId: character.id,
                trackId: track.id,
                startTime: 100,
                endTime: 1300,
            })
        );
        const artist = await dataSource.manager.save(new Artist({ name: 'Record API artist' }));

        const response = await request(app.getHttpServer())
            .post('/records')
            .send({
                cueId: cue.id,
                artistId: artist.id,
                status: 'approved',
                audioUrl: 'https://assets.example.com/record-api.wav',
                durationMs: 1200,
                volume: 0.75,
            })
            .expect(201);

        assert.deepEqual(response.body, { data: {} });

        const storedRecords = await dataSource.manager.find(Record, {
            where: {
                cueId: cue.id,
                artistId: artist.id,
            },
        });

        assert.equal(storedRecords.length, 1);
        assert.equal(storedRecords[0].status, 'approved');
        assert.equal(storedRecords[0].audioUrl, 'https://assets.example.com/record-api.wav');
        assert.equal(storedRecords[0].durationMs, 1200);
        assert.equal(storedRecords[0].volume, 0.75);
    } finally {
        await app.close();
    }
});
