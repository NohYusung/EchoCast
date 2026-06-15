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
import { Pause } from '../../pauses/domain/pause.entity';
import { PauseRepository } from '../../pauses/repository/pause.repository';
import { Product } from '../../products/domain/product.entity';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { ScrollRepository } from '../../scrolls/repository/scroll.repository';
import { Track } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { Anchor } from '../domain/anchor.entity';
import { AnchorRepository } from '../repository/anchor.repository';
import { AnchorService } from './anchor.service';

describe('AnchorService', () => {
    it('creates an anchor for a track and canvas in the same episode', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Pause, Product, Scroll, Track],
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
                new CanvasRepository(dataSource),
                new ScrollRepository(dataSource),
                new PauseRepository(dataSource)
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
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Pause, Product, Scroll, Track],
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
                new CanvasRepository(dataSource),
                new ScrollRepository(dataSource),
                new PauseRepository(dataSource)
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
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Pause, Product, Scroll, Track],
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
                new CanvasRepository(dataSource),
                new ScrollRepository(dataSource),
                new PauseRepository(dataSource)
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

    it('lets an anchor own either a scroll event or a pause event', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Pause, Product, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Anchor event product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Anchor event episode',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Anchor event track',
                    type: 'scroll',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const startAnchor = await dataSource.manager.save(
                new Anchor({
                    trackId: track.id,
                    canvasId: canvas.id,
                    time: 1000,
                    position: 20,
                    index: 0,
                })
            );
            const endAnchor = await dataSource.manager.save(
                new Anchor({
                    trackId: track.id,
                    canvasId: canvas.id,
                    time: 3000,
                    position: 70,
                    index: 1,
                })
            );
            const anchorService = new AnchorService(
                new AnchorRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new ScrollRepository(dataSource),
                new PauseRepository(dataSource)
            );

            await anchorService.upsertEvent({
                trackId: track.id,
                anchorId: startAnchor.id,
                type: 'scroll',
                endAnchorId: endAnchor.id,
            });

            const scrollEventList = await anchorService.list({ trackId: track.id });
            const scrollOwner = scrollEventList.items.find((item) => item.id === startAnchor.id);

            assert.ok(scrollOwner?.event);
            assert.equal(scrollOwner.event.type, 'scroll');
            if (scrollOwner.event.type !== 'scroll') {
                throw new Error('예상한 스크롤 이벤트가 없습니다.');
            }
            assert.equal(scrollOwner.event.startAnchorId, startAnchor.id);
            assert.equal(scrollOwner.event.endAnchorId, endAnchor.id);

            await anchorService.upsertEvent({
                trackId: track.id,
                anchorId: startAnchor.id,
                type: 'pause',
                duration: 1800,
            });

            const pauseEventList = await anchorService.list({ trackId: track.id });
            const pauseOwner = pauseEventList.items.find((item) => item.id === startAnchor.id);
            const scrollCount = await dataSource.manager.count(Scroll);

            assert.equal(scrollCount, 0);
            assert.ok(pauseOwner?.event);
            assert.equal(pauseOwner.event.type, 'pause');
            if (pauseOwner.event.type !== 'pause') {
                throw new Error('예상한 일시정지 이벤트가 없습니다.');
            }
            assert.deepEqual(pauseOwner.event, {
                type: 'pause',
                id: pauseOwner.event.id,
                pauseId: pauseOwner.event.id,
                anchorId: startAnchor.id,
                duration: 1800,
                canvasId: canvas.id,
                index: 0,
                time: 1000,
                position: 20,
            });

            await anchorService.deleteEvent({ trackId: track.id, anchorId: startAnchor.id });

            const deletedEventList = await anchorService.list({ trackId: track.id });
            const emptyOwner = deletedEventList.items.find((item) => item.id === startAnchor.id);
            const storedAnchor = await dataSource.manager.findOneByOrFail(Anchor, { id: startAnchor.id });

            assert.equal(emptyOwner?.event, null);
            assert.equal(storedAnchor.id, startAnchor.id);
        } finally {
            await dataSource.destroy();
        }
    });

    it('deletes an anchor separately and clears dependent scroll and pause events', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Pause, Product, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Anchor delete product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Anchor delete episode',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Anchor delete track',
                    type: 'scroll',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const startAnchor = await dataSource.manager.save(
                new Anchor({
                    trackId: track.id,
                    canvasId: canvas.id,
                    time: 1000,
                    position: 10,
                    index: 0,
                })
            );
            const endAnchor = await dataSource.manager.save(
                new Anchor({
                    trackId: track.id,
                    canvasId: canvas.id,
                    time: 3000,
                    position: 80,
                    index: 1,
                })
            );
            const pauseAnchor = await dataSource.manager.save(
                new Anchor({
                    trackId: track.id,
                    canvasId: canvas.id,
                    time: 5000,
                    position: 40,
                    index: 2,
                })
            );
            const anchorService = new AnchorService(
                new AnchorRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new ScrollRepository(dataSource),
                new PauseRepository(dataSource)
            );

            await anchorService.upsertEvent({
                trackId: track.id,
                anchorId: startAnchor.id,
                type: 'scroll',
                endAnchorId: endAnchor.id,
            });
            await anchorService.delete({ trackId: track.id, anchorId: endAnchor.id });

            const deletedEndAnchor = await dataSource.manager.findOne(Anchor, {
                where: { id: endAnchor.id },
                withDeleted: true,
            });
            const visibleEndAnchor = await dataSource.manager.findOneBy(Anchor, { id: endAnchor.id });
            const visibleStartAnchor = await dataSource.manager.findOneByOrFail(Anchor, { id: startAnchor.id });

            assert.ok(deletedEndAnchor?.deletedAt);
            assert.equal(visibleEndAnchor, null);
            assert.equal(visibleStartAnchor.id, startAnchor.id);
            assert.equal(await dataSource.manager.count(Scroll), 0);

            await anchorService.upsertEvent({
                trackId: track.id,
                anchorId: pauseAnchor.id,
                type: 'pause',
                duration: 1200,
            });
            await anchorService.delete({ trackId: track.id, anchorId: pauseAnchor.id });

            const deletedPauseAnchor = await dataSource.manager.findOne(Anchor, {
                where: { id: pauseAnchor.id },
                withDeleted: true,
            });

            assert.ok(deletedPauseAnchor?.deletedAt);
            assert.equal(await dataSource.manager.count(Pause), 0);
            await assert.rejects(
                () => anchorService.delete({ trackId: track.id, anchorId: 999999 }),
                NotFoundException
            );
        } finally {
            await dataSource.destroy();
        }
    });
});
