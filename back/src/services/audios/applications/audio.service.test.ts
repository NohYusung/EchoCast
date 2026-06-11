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
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Audio service character',
                    role: 'starring',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Audio service track',
                    type: 'record',
                    characterId: character.id,
                })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    script: 'Audio service cue',
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 1000,
                    endTime: 4000,
                })
            );
            const audioRepository = new AudioRepository(dataSource);
            const audioService = new AudioService(audioRepository);
            const createdAudio = await audioService.create({
                episodeId: episode.id,
                cueId: cue.id,
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
                        cueId: cue.id,
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
});
