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
import { Audio } from './audio.entity';

describe('Audio', () => {
    it('stores source audio data with episode and optional cue relation', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Audio, Character, Cue, Episode, Product, Scroll, Track],
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
            const cue = await dataSource.manager.save(
                new Cue({
                    script: 'Audio cue',
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 0,
                    endTime: 12000,
                })
            );

            const audio = await dataSource.manager.save(
                new Audio({
                    episodeId: episode.id,
                    cueId: cue.id,
                    audioType: 'bgm',
                    name: 'Opening BGM',
                    audioUrl: 'https://assets.example.com/audio/opening-bgm.mp3',
                    duration: 12000,
                })
            );

            const storedAudio = await dataSource.manager.findOneOrFail(Audio, {
                where: { id: audio.id },
                relations: { episode: true, cue: true },
            });

            assert.equal(storedAudio.episodeId, episode.id);
            assert.equal(storedAudio.cueId, cue.id);
            assert.equal(storedAudio.episode.id, episode.id);
            assert.equal(storedAudio.cue?.id, cue.id);
            assert.equal(storedAudio.audioType, 'bgm');
            assert.equal(storedAudio.name, 'Opening BGM');
            assert.equal(storedAudio.audioUrl, 'https://assets.example.com/audio/opening-bgm.mp3');
            assert.equal(storedAudio.duration, 12000);

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

    it('requires audio duration', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Audio, Character, Cue, Episode, Product, Scroll, Track],
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

            await assert.rejects(() =>
                dataSource.manager.save(
                    new Audio({
                        episodeId: episode.id,
                        audioType: 'effect',
                        name: 'impact.wav',
                        audioUrl: 'https://assets.example.com/audio/impact.wav',
                    } as any)
                )
            );
        } finally {
            await dataSource.destroy();
        }
    });
});
