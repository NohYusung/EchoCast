import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Character } from '../../characters/domain/character.entity';
import { Cue } from '../../cues/domain/cue.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Product } from '../../products/domain/product.entity';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Track } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { CueRepository } from '../../cues/repository/cue.repository';
import { Audio } from '../domain/audio.entity';
import { AudioRepository } from '../repository/audio.repository';
import { AudioService } from './audio.service';

describe('AudioService', () => {
    it('creates audio and lists it by episode', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Audio, Character, Cue, Episode, Product, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Audio service product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Audio service episode',
                })
            );
            const audioRepository = new AudioRepository(dataSource);
            const audioService = new AudioService(
                audioRepository,
                new TrackRepository(dataSource),
                new CueRepository(dataSource)
            );
            const createdAudio = await audioService.create({
                episodeId: episode.id,
                audioType: 'effect',
                name: 'impact.wav',
                audioUrl: 'https://assets.example.com/audios/impact.wav',
                duration: 3000,
            });

            const audioList = await audioService.list({ episodeId: episode.id });

            assert.deepEqual(audioList, {
                items: [
                    {
                        id: createdAudio.id,
                        episodeId: episode.id,
                        audioType: 'effect',
                        name: 'impact.wav',
                        audioUrl: 'https://assets.example.com/audios/impact.wav',
                        duration: 3000,
                    },
                ],
                total: 1,
            });
        } finally {
            await dataSource.destroy();
        }
    });

    it('drops an audio file by creating a track and a cue linked with audioId', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Audio, Character, Cue, Episode, Product, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Audio drop product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Audio drop episode',
                })
            );
            const audioService = new AudioService(
                new AudioRepository(dataSource),
                new TrackRepository(dataSource),
                new CueRepository(dataSource)
            );
            const audio = await audioService.create({
                episodeId: episode.id,
                audioType: 'bgm',
                name: 'opening.mp3',
                audioUrl: 'https://assets.example.com/audios/opening.mp3',
                duration: 8000,
            });

            const dropped = await audioService.dropToTrack({
                episodeId: episode.id,
                audioId: audio.id,
                trackName: 'Opening BGM',
                trackType: 'bgm',
                startTime: 1500,
                volume: 0.75,
            });
            const storedCue = await dataSource.manager.findOneOrFail(Cue, {
                where: { id: dropped.cue.id },
                relations: { audio: true, track: true },
            });

            assert.equal(dropped.track.name, 'Opening BGM');
            assert.equal(dropped.track.type, 'bgm');
            assert.equal(dropped.cue.audioId, audio.id);
            assert.equal(dropped.cue.startTime, 1500);
            assert.equal(dropped.cue.endTime, 9500);
            assert.equal(dropped.cue.volume, 0.75);
            assert.equal(storedCue.audioId, audio.id);
            assert.equal(storedCue.audio?.audioUrl, 'https://assets.example.com/audios/opening.mp3');
            assert.equal(storedCue.track.name, 'Opening BGM');
        } finally {
            await dataSource.destroy();
        }
    });
});
