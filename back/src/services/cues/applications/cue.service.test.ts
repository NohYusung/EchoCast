import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Audio } from '../../audios/domain/audio.entity';
import { Character } from '../../characters/domain/character.entity';
import { Product } from '../../products/domain/product.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Track } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { Cue } from '../domain/cue.entity';
import { CueRepository } from '../repository/cue.repository';
import { CueService } from './cue.service';

async function createCueServiceDataSource() {
    const dataSource = new DataSource({
        type: 'sqljs',
        entities: [Audio, Character, Cue, Episode, Product, Scroll, Track],
        synchronize: true,
        logging: false,
    });
    await dataSource.initialize();
    return dataSource;
}

describe('CueService', () => {
    it('creates a cue with script text for a character-linked track', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue service product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue service episode',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Cue service character',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue service track',
                    type: 'record',
                    characterId: character.id,
                })
            );
            const cueService = new CueService(new CueRepository(dataSource), new TrackRepository(dataSource));

            const created = await cueService.create({
                trackId: track.id,
                script: '새 큐 대사',
                startTime: 1200,
                endTime: 5200,
                volume: 0.8,
            });

            const [storedCue] = await dataSource.manager.find(Cue, {
                where: {
                    id: created.id,
                },
            });
            assert.equal(created.script, '새 큐 대사');
            assert.equal(storedCue.trackId, track.id);
            assert.equal(storedCue.script, '새 큐 대사');
            assert.equal(storedCue.characterId, character.id);
            assert.equal(storedCue.startTime, 1200);
            assert.equal(storedCue.endTime, 5200);
            assert.equal(storedCue.volume, 0.8);
        } finally {
            await dataSource.destroy();
        }
    });

    it('throws NotFoundException when the target track does not exist', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const cueService = new CueService(new CueRepository(dataSource), new TrackRepository(dataSource));

            await assert.rejects(
                () =>
                    cueService.create({
                        trackId: 9999,
                        script: '없는 트랙',
                        startTime: 0,
                        endTime: 1000,
                    }),
                (error: unknown) => error instanceof NotFoundException
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('throws BadRequestException when the target record track has no character', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue service product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue service episode',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue service record track',
                    type: 'record',
                })
            );
            const cueService = new CueService(new CueRepository(dataSource), new TrackRepository(dataSource));

            await assert.rejects(
                () =>
                    cueService.create({
                        trackId: track.id,
                        script: '캐릭터 없는 트랙',
                        startTime: 0,
                        endTime: 1000,
                    }),
                (error: unknown) => error instanceof BadRequestException
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('updates a cue with trimmed script text and timing', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue update product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue update episode',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Cue update character',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue update track',
                    type: 'record',
                    characterId: character.id,
                })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    script: '수정 전 대사',
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 1000,
                    endTime: 3000,
                    volume: 1,
                })
            );
            const cueService = new CueService(new CueRepository(dataSource), new TrackRepository(dataSource));

            await cueService.update({
                trackId: track.id,
                cueId: cue.id,
                script: '  수정 후 대사  ',
                startTime: 1500,
                endTime: 4500,
                volume: 0.7,
            });

            const [storedCue] = await dataSource.manager.find(Cue, {
                where: {
                    id: cue.id,
                },
            });
            assert.equal(storedCue.script, '수정 후 대사');
            assert.equal(storedCue.characterId, character.id);
            assert.equal(storedCue.trackId, track.id);
            assert.equal(storedCue.startTime, 1500);
            assert.equal(storedCue.endTime, 4500);
            assert.equal(storedCue.volume, 0.7);
        } finally {
            await dataSource.destroy();
        }
    });

    it('soft deletes a cue by track and cue id', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue delete product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue delete episode',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Cue delete character',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue delete track',
                    type: 'record',
                    characterId: character.id,
                })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    script: '삭제할 큐',
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 1000,
                    endTime: 3000,
                })
            );
            const cueService = new CueService(new CueRepository(dataSource), new TrackRepository(dataSource));

            await cueService.delete({ trackId: track.id, cueId: cue.id });

            const storedCues = await dataSource.manager.find(Cue, {
                where: {
                    id: cue.id,
                },
            });
            const [deletedCue] = await dataSource.manager.find(Cue, {
                where: {
                    id: cue.id,
                },
                withDeleted: true,
            });
            assert.equal(storedCues.length, 0);
            assert.ok(deletedCue.deletedAt);
        } finally {
            await dataSource.destroy();
        }
    });
});
