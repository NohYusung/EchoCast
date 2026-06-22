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
import { Script } from '../../scripts/domain/script.entity';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Track } from '../../tracks/domain/track.entity';
import { Audio } from './audio.entity';

describe('Audio', () => {
    it('stores source audio data with episode and optional cue relation', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Script, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Audio test product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Audio test episode',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Audio test character',
                    role: 'starring',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'BGM track',
                    type: 'bgm',
                    characterId: character.id,
                })
            );
            const audio = await dataSource.manager.save(
                new Audio({
                    episodeId: episode.id,
                    audioType: 'bgm',
                    name: 'Opening BGM',
                    audioUrl: 'https://assets.example.com/audio/opening-bgm.mp3',
                    duration: 12000,
                })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    characterId: character.id,
                    trackId: track.id,
                    audioId: audio.id,
                    startTime: 0,
                    endTime: 12000,
                })
            );

            const storedAudio = await dataSource.manager.findOneOrFail(Audio, {
                where: { id: audio.id },
                relations: { episode: true, cues: true },
            });

            assert.equal(storedAudio.episodeId, episode.id);
            assert.equal(storedAudio.episode.id, episode.id);
            assert.deepEqual(storedAudio.cues?.map((storedCue) => storedCue.id), [cue.id]);
            assert.equal(storedAudio.audioType, 'bgm');
            assert.equal(storedAudio.name, 'Opening BGM');
            assert.equal(storedAudio.audioUrl, 'https://assets.example.com/audio/opening-bgm.mp3');
            assert.equal(storedAudio.duration, 12000);

            const storedCue = await dataSource.manager.findOneOrFail(Cue, {
                where: { id: cue.id },
                relations: { audio: true },
            });

            assert.equal(storedCue.audioId, audio.id);
            assert.equal(storedCue.audio?.id, audio.id);

            storedAudio.update({
                name: 'Opening BGM updated',
                duration: 12500,
            });
            await dataSource.manager.save(storedAudio);

            const updatedAudio = await dataSource.manager.findOneByOrFail(Audio, { id: audio.id });

            assert.equal(updatedAudio.name, 'Opening BGM updated');
            assert.equal(updatedAudio.duration, 12500);
        } finally {
            await dataSource.destroy();
        }
    });

    it('stores audio without duration', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Script, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Audio duration product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Audio duration episode',
                })
            );

            const audio = await dataSource.manager.save(
                new Audio({
                    episodeId: episode.id,
                    audioType: 'effect',
                    name: 'impact.wav',
                    audioUrl: 'https://assets.example.com/audio/impact.wav',
                } as any)
            );

            const storedAudio = await dataSource.manager.findOneByOrFail(Audio, { id: audio.id });

            assert.equal(storedAudio.duration, null);
        } finally {
            await dataSource.destroy();
        }
    });
});
