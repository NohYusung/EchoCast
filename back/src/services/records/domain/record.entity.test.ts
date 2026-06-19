import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Anchor } from '../../anchors/domain/anchor.entity';
import { Artist } from '../../artists/domain/artist.entity';
import { Audio } from '../../audios/domain/audio.entity';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Character } from '../../characters/domain/character.entity';
import { Cue } from '../../cues/domain/cue.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Media } from '../../medias/domain/media.entity';
import { Product } from '../../products/domain/product.entity';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Track } from '../../tracks/domain/track.entity';
import { Record } from './record.entity';

describe('Record', () => {
    it('stores an artist recorded file with cue and artist relations', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Artist, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Record, Scroll, Track],
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
            const audio = await dataSource.manager.save(
                new Audio({
                    episodeId: episode.id,
                    audioType: 'record',
                    name: 'record.wav',
                    audioUrl: 'https://assets.example.com/record.wav',
                    duration: 2000,
                })
            );

            const record = await dataSource.manager.save(
                new Record({
                    cueId: cue.id,
                    artistId: artist.id,
                    audioId: audio.id,
                    isAccepted: true,
                })
            );

            const storedRecord = await dataSource.manager.findOneOrFail(Record, {
                where: { id: record.id },
                relations: { cue: true, artist: true, audio: true },
            });

            assert.equal(storedRecord.cueId, cue.id);
            assert.equal(storedRecord.artistId, artist.id);
            assert.equal(storedRecord.cue.id, cue.id);
            assert.ok(storedRecord.artist);
            assert.equal(storedRecord.artist.id, artist.id);
            assert.equal(storedRecord.artist.name, 'Record artist');
            assert.equal(storedRecord.audioId, audio.id);
            assert.ok(storedRecord.audio);
            assert.equal(storedRecord.audio.audioType, 'record');
            assert.equal(storedRecord.audio.audioUrl, 'https://assets.example.com/record.wav');
            assert.equal(storedRecord.audio.duration, 2000);
            assert.equal(storedRecord.isAccepted, true);
        } finally {
            await dataSource.destroy();
        }
    });

    it('stores a record without artist and duration', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Artist, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Record, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Record nullable duration product' }));
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Record nullable duration character',
                })
            );
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Record nullable duration episode',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Record nullable duration track',
                    type: 'record',
                })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    script: 'record nullable duration script',
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 1000,
                    endTime: 3000,
                })
            );
            const audio = await dataSource.manager.save(
                new Audio({
                    episodeId: episode.id,
                    audioType: 'record',
                    name: 'record-without-duration.wav',
                    audioUrl: 'https://assets.example.com/record-without-duration.wav',
                })
            );

            const record = await dataSource.manager.save(
                new Record({
                    cueId: cue.id,
                    audioId: audio.id,
                })
            );

            const storedRecord = await dataSource.manager.findOneOrFail(Record, {
                where: { id: record.id },
                relations: { audio: true },
            });

            assert.equal(storedRecord.artistId, null);
            assert.ok(storedRecord.audio);
            assert.equal(storedRecord.audio.duration, null);
            assert.equal(storedRecord.isAccepted, false);
        } finally {
            await dataSource.destroy();
        }
    });
});
