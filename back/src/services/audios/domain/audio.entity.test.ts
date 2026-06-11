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
    it('stores non-record audio data with episode and optional track relation', async () => {
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
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'BGM track',
                    type: 'bgm',
                })
            );

            const audio = await dataSource.manager.save(
                new Audio({
                    episodeId: episode.id,
                    trackId: track.id,
                    audioType: 'bgm',
                    name: 'Opening BGM',
                    audioUrl: 'https://assets.example.com/audio/opening-bgm.mp3',
                    startTime: 0,
                    endTime: 12000,
                    durationMs: 12000,
                    volume: 0.72,
                    metadata: {
                        source: 'upload',
                    },
                })
            );

            const storedAudio = await dataSource.manager.findOneOrFail(Audio, {
                where: { id: audio.id },
                relations: { episode: true, track: true },
            });

            assert.equal(storedAudio.episodeId, episode.id);
            assert.equal(storedAudio.trackId, track.id);
            assert.equal(storedAudio.episode.id, episode.id);
            assert.equal(storedAudio.track?.id, track.id);
            assert.equal(storedAudio.audioType, 'bgm');
            assert.equal(storedAudio.name, 'Opening BGM');
            assert.equal(storedAudio.audioUrl, 'https://assets.example.com/audio/opening-bgm.mp3');
            assert.equal(storedAudio.startTime, 0);
            assert.equal(storedAudio.endTime, 12000);
            assert.equal(storedAudio.durationMs, 12000);
            assert.equal(storedAudio.volume, 0.72);
            assert.deepEqual(storedAudio.metadata, { source: 'upload' });

            storedAudio.update({
                name: 'Opening BGM updated',
                startTime: 500,
                endTime: 12500,
                volume: 0.8,
            });
            await dataSource.manager.save(storedAudio);

            const updatedAudio = await dataSource.manager.findOneByOrFail(Audio, { id: audio.id });

            assert.equal(updatedAudio.name, 'Opening BGM updated');
            assert.equal(updatedAudio.startTime, 500);
            assert.equal(updatedAudio.endTime, 12500);
            assert.equal(updatedAudio.durationMs, 12000);
            assert.equal(updatedAudio.volume, 0.8);
        } finally {
            await dataSource.destroy();
        }
    });
});
