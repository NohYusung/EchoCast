import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Artist } from '../../artists/domain/artist.entity';
import { Character } from '../../characters/domain/character.entity';
import { Cue } from '../../cues/domain/cue.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Product } from '../../products/domain/product.entity';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Track } from '../../tracks/domain/track.entity';
import { Record } from './record.entity';

describe('Record', () => {
    it('stores an artist recorded file with cue and artist relations', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Artist, Character, Cue, Episode, Product, Record, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Record test product' }));
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Record test character',
                })
            );
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Record test episode',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Record track',
                    type: 'record',
                })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    script: 'record test script',
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 1000,
                    endTime: 3000,
                })
            );
            const artist = await dataSource.manager.save(new Artist({ name: 'Record artist' }));

            const record = await dataSource.manager.save(
                new Record({
                    cueId: cue.id,
                    artistId: artist.id,
                    status: 'approved',
                    audioUrl: 'https://assets.example.com/record.wav',
                    durationMs: 2000,
                    volume: 0.8,
                })
            );

            const storedRecord = await dataSource.manager.findOneOrFail(Record, {
                where: { id: record.id },
                relations: { cue: true, artist: true },
            });

            assert.equal(storedRecord.cueId, cue.id);
            assert.equal(storedRecord.artistId, artist.id);
            assert.equal(storedRecord.cue.id, cue.id);
            assert.equal(storedRecord.artist.id, artist.id);
            assert.equal(storedRecord.artist.name, 'Record artist');
            assert.equal(storedRecord.audioUrl, 'https://assets.example.com/record.wav');
            assert.equal(storedRecord.durationMs, 2000);
            assert.equal(storedRecord.status, 'approved');
            assert.equal(storedRecord.volume, 0.8);
        } finally {
            await dataSource.destroy();
        }
    });
});
