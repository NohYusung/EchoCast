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

test('records API creates, lists, updates, and deletes a record for a cue and artist', async () => {
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
                recordUrl: 'https://assets.example.com/record-api.wav',
                duration: 1200,
                volume: 0.75,
                isAccepted: true,
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
        assert.equal(storedRecords[0].recordUrl, 'https://assets.example.com/record-api.wav');
        assert.equal(storedRecords[0].duration, 1200);
        assert.equal(storedRecords[0].volume, 0.75);
        assert.equal(storedRecords[0].isAccepted, true);

        const recordId = storedRecords[0].id;
        await request(app.getHttpServer())
            .post('/records')
            .send({
                cueId: cue.id,
                artistId: artist.id,
                recordUrl: 'https://assets.example.com/record-api-second.wav',
                duration: 900,
                volume: 0.9,
                isAccepted: true,
            })
            .expect(201);

        const acceptedAfterSecondCreate = await dataSource.manager.find(Record, {
            where: {
                cueId: cue.id,
            },
            order: {
                id: 'ASC',
            },
        });
        assert.equal(acceptedAfterSecondCreate.length, 2);
        assert.equal(acceptedAfterSecondCreate[0].isAccepted, false);
        assert.equal(acceptedAfterSecondCreate[1].isAccepted, true);

        const listResponse = await request(app.getHttpServer()).get('/records').expect(200);
        const listedRecord = listResponse.body.data.items.find((item: { id: number }) => item.id === recordId);

        assert.equal(listResponse.body.data.total, 2);
        assert.ok(listedRecord);
        assert.equal(listedRecord.cueId, cue.id);
        assert.equal(listedRecord.artistId, artist.id);
        assert.equal(listedRecord.recordUrl, 'https://assets.example.com/record-api.wav');
        assert.equal(listedRecord.duration, 1200);
        assert.equal(listedRecord.volume, 0.75);
        assert.equal(listedRecord.isAccepted, false);

        const updateResponse = await request(app.getHttpServer())
            .put(`/records/${recordId}`)
            .send({
                recordUrl: 'https://assets.example.com/record-api-updated.wav',
                duration: 1500,
                volume: 0.5,
                isAccepted: true,
            })
            .expect(200);

        assert.deepEqual(updateResponse.body, { data: {} });

        const updatedRecord = await dataSource.manager.findOneByOrFail(Record, { id: recordId });
        assert.equal(updatedRecord.recordUrl, 'https://assets.example.com/record-api-updated.wav');
        assert.equal(updatedRecord.duration, 1500);
        assert.equal(updatedRecord.volume, 0.5);
        assert.equal(updatedRecord.isAccepted, true);
        const acceptedAfterUpdate = await dataSource.manager.find(Record, {
            where: {
                cueId: cue.id,
            },
            order: {
                id: 'ASC',
            },
        });
        assert.equal(acceptedAfterUpdate[0].isAccepted, true);
        assert.equal(acceptedAfterUpdate[1].isAccepted, false);

        const deleteResponse = await request(app.getHttpServer()).delete(`/records/${recordId}`).expect(200);

        assert.deepEqual(deleteResponse.body, { data: {} });
        const remainingRecords = await dataSource.manager.find(Record, {
            where: {
                cueId: cue.id,
                artistId: artist.id,
            },
        });
        const [deletedRecord] = await dataSource.manager.find(Record, {
            withDeleted: true,
            where: {
                id: recordId,
            },
        });

        assert.equal(remainingRecords.length, 1);
        assert.ok(deletedRecord.deletedAt);
    } finally {
        await app.close();
    }
});
