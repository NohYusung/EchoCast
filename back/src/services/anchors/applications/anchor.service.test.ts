import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Audio } from '../../audios/domain/audio.entity';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import { Character } from '../../characters/domain/character.entity';
import { Cue } from '../../cues/domain/cue.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Media } from '../../medias/domain/media.entity';
import { Product } from '../../products/domain/product.entity';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Track } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { Anchor } from '../domain/anchor.entity';
import { AnchorRepository } from '../repository/anchor.repository';
import { AnchorService } from './anchor.service';

describe('AnchorService', () => {
    it('creates an anchor for a track and canvas in the same episode', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Anchor service product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Anchor service episode',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Anchor track',
                    type: 'scroll',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const anchorService = new AnchorService(
                new AnchorRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource)
            );

            const createdAnchor = await anchorService.create({
                trackId: track.id,
                canvasId: canvas.id,
                time: 2400,
                position: 42.5,
                index: 3,
            });
            const storedAnchor = await dataSource.manager.findOneByOrFail(Anchor, { id: createdAnchor.id });

            assert.equal(createdAnchor.trackId, track.id);
            assert.equal(createdAnchor.canvasId, canvas.id);
            assert.equal(createdAnchor.time, 2400);
            assert.equal(createdAnchor.position, 42.5);
            assert.equal(createdAnchor.index, 3);
            assert.equal(storedAnchor.trackId, track.id);
            assert.equal(storedAnchor.canvasId, canvas.id);
        } finally {
            await dataSource.destroy();
        }
    });

    it('rejects missing tracks and canvases from a different episode', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Anchor validation product' }));
            const firstEpisode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Anchor validation episode 1',
                })
            );
            const secondEpisode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 2,
                    title: 'Anchor validation episode 2',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: firstEpisode.id,
                    name: 'Anchor validation track',
                    type: 'scroll',
                })
            );
            const otherEpisodeCanvas = await dataSource.manager.save(new Canvas({ episodeId: secondEpisode.id }));
            const anchorService = new AnchorService(
                new AnchorRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource)
            );

            await assert.rejects(
                () =>
                    anchorService.create({
                        trackId: 999999,
                        canvasId: otherEpisodeCanvas.id,
                        time: 1000,
                        position: 50,
                        index: 0,
                    }),
                NotFoundException
            );
            await assert.rejects(
                () =>
                    anchorService.create({
                        trackId: track.id,
                        canvasId: otherEpisodeCanvas.id,
                        time: 1000,
                        position: 50,
                        index: 0,
                    }),
                BadRequestException
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('updates an anchor after validating canvas ownership and position bounds', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Anchor update product' }));
            const firstEpisode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Anchor update episode 1',
                })
            );
            const secondEpisode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 2,
                    title: 'Anchor update episode 2',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: firstEpisode.id,
                    name: 'Anchor update track',
                    type: 'scroll',
                })
            );
            const initialCanvas = await dataSource.manager.save(new Canvas({ episodeId: firstEpisode.id }));
            const nextCanvas = await dataSource.manager.save(new Canvas({ episodeId: firstEpisode.id }));
            const otherEpisodeCanvas = await dataSource.manager.save(new Canvas({ episodeId: secondEpisode.id }));
            const anchor = await dataSource.manager.save(
                new Anchor({
                    trackId: track.id,
                    canvasId: initialCanvas.id,
                    time: 1000,
                    position: 20,
                    index: 0,
                })
            );
            const anchorService = new AnchorService(
                new AnchorRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource)
            );

            await anchorService.update({
                trackId: track.id,
                anchorId: anchor.id,
                canvasId: nextCanvas.id,
                time: 1800,
                position: 72.25,
                index: 4,
            });

            const updatedAnchor = await dataSource.manager.findOneByOrFail(Anchor, { id: anchor.id });

            assert.equal(updatedAnchor.canvasId, nextCanvas.id);
            assert.equal(updatedAnchor.time, 1800);
            assert.equal(updatedAnchor.position, 72.25);
            assert.equal(updatedAnchor.index, 4);
            await assert.rejects(
                () =>
                    anchorService.update({
                        trackId: track.id,
                        anchorId: anchor.id,
                        canvasId: otherEpisodeCanvas.id,
                    }),
                BadRequestException
            );
            await assert.rejects(
                () =>
                    anchorService.update({
                        trackId: track.id,
                        anchorId: anchor.id,
                        position: 120,
                    }),
                BadRequestException
            );
            await assert.rejects(
                () =>
                    anchorService.update({
                        trackId: track.id,
                        anchorId: 999999,
                        position: 10,
                    }),
                NotFoundException
            );
        } finally {
            await dataSource.destroy();
        }
    });
});
