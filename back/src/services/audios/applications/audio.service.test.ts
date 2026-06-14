import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Anchor } from '../../anchors/domain/anchor.entity';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Character } from '../../characters/domain/character.entity';
import { Cue } from '../../cues/domain/cue.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Media } from '../../medias/domain/media.entity';
import { Product } from '../../products/domain/product.entity';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Track } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { Audio } from '../domain/audio.entity';
import { AudioRepository } from '../repository/audio.repository';
import { AudioService } from './audio.service';

describe('AudioService', () => {
    it('creates audio and lists it by episode', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Scroll, Track],
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
                new TrackRepository(dataSource)
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
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Scroll, Track],
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
                new TrackRepository(dataSource)
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

    it('drops the same audio file more than once as separate cues', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Audio reuse product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Audio reuse episode',
                })
            );
            const audioService = new AudioService(
                new AudioRepository(dataSource),
                new TrackRepository(dataSource)
            );
            const audio = await audioService.create({
                episodeId: episode.id,
                audioType: 'audio',
                name: 'voice.wav',
                audioUrl: 'https://assets.example.com/audios/voice.wav',
                duration: 1500,
            });
            const firstDrop = await audioService.dropToTrack({
                episodeId: episode.id,
                audioId: audio.id,
                trackName: 'Voice',
                trackType: 'audio',
                startTime: 1000,
                volume: 1,
            });

            const secondDrop = await audioService.dropToTrack({
                episodeId: episode.id,
                audioId: audio.id,
                trackId: firstDrop.track.id,
                startTime: 3000,
                volume: 1,
            });
            const storedCues = await dataSource.manager.find(Cue, {
                where: { audioId: audio.id },
                order: { startTime: 'ASC' },
            });

            assert.notEqual(secondDrop.cue.id, firstDrop.cue.id);
            assert.equal(secondDrop.track.id, firstDrop.track.id);
            assert.deepEqual(
                storedCues.map((cue) => ({
                    audioId: cue.audioId,
                    trackId: cue.trackId,
                    startTime: cue.startTime,
                    endTime: cue.endTime,
                })),
                [
                    {
                        audioId: audio.id,
                        trackId: firstDrop.track.id,
                        startTime: 1000,
                        endTime: 2500,
                    },
                    {
                        audioId: audio.id,
                        trackId: firstDrop.track.id,
                        startTime: 3000,
                        endTime: 4500,
                    },
                ]
            );
        } finally {
            await dataSource.destroy();
        }
    });
});
