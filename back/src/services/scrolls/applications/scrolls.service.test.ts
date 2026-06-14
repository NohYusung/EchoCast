import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Anchor } from '../../anchors/domain/anchor.entity';
import { AnchorRepository } from '../../anchors/repository/anchor.repository';
import { Audio } from '../../audios/domain/audio.entity';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Character } from '../../characters/domain/character.entity';
import { Cue } from '../../cues/domain/cue.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Media } from '../../medias/domain/media.entity';
import { Product } from '../../products/domain/product.entity';
import { Track } from '../../tracks/domain/track.entity';
import { Scroll } from '../domain/scroll.entity';
import { ScrollRepository } from '../repository/scroll.repository';
import { ScrollsService } from './scrolls.service';

async function createScrollsServiceDataSource() {
    const dataSource = new DataSource({
        type: 'sqljs',
        entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Scroll, Track],
        synchronize: true,
        logging: false,
    });
    await dataSource.initialize();
    return dataSource;
}

describe('ScrollsService', () => {
    it('creates a scroll event by linking existing anchors', async () => {
        const dataSource = await createScrollsServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Scroll create product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Scroll create episode',
                })
            );
            const scrollTrack = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Scroll create track',
                    type: 'scroll',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const startAnchor = await dataSource.manager.save(
                new Anchor({
                    trackId: scrollTrack.id,
                    canvasId: canvas.id,
                    time: 1000,
                    index: 0,
                    position: 10,
                })
            );
            const endAnchor = await dataSource.manager.save(
                new Anchor({
                    trackId: scrollTrack.id,
                    canvasId: canvas.id,
                    time: 3000,
                    index: 1,
                    position: 70,
                })
            );
            const scrollsService = new ScrollsService(new ScrollRepository(dataSource), new AnchorRepository(dataSource));

            const createdScroll = await scrollsService.create({
                trackId: scrollTrack.id,
                startAnchorId: startAnchor.id,
                endAnchorId: endAnchor.id,
            });
            const anchorCount = await dataSource.manager.count(Anchor, { where: { trackId: scrollTrack.id } });

            assert.equal(anchorCount, 2);
            assert.deepEqual(createdScroll, {
                id: createdScroll.id,
                trackId: scrollTrack.id,
                startAnchorId: startAnchor.id,
                endAnchorId: endAnchor.id,
                canvasId: canvas.id,
                startIndex: 0,
                endIndex: 1,
                startTime: 1000,
                endTime: 3000,
                startPosition: 10,
                endPosition: 70,
            });
        } finally {
            await dataSource.destroy();
        }
    });

    it('lists scroll events for a track ordered by start time with total', async () => {
        const dataSource = await createScrollsServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Scroll list product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Scroll list episode',
                })
            );
            const scrollTrack = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Scroll track',
                    type: 'scroll',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const otherTrack = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Other scroll track',
                    type: 'scroll',
                })
            );
            const laterScroll = await dataSource.manager.save(
                new Scroll({
                    trackId: scrollTrack.id,
                    startAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: scrollTrack.id,
                                canvasId: canvas.id,
                                time: 3000,
                                index: 1,
                                position: 30,
                            })
                        )
                    ).id,
                    endAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: scrollTrack.id,
                                canvasId: canvas.id,
                                time: 6000,
                                index: 1,
                                position: 90,
                            })
                        )
                    ).id,
                })
            );
            const earlierScroll = await dataSource.manager.save(
                new Scroll({
                    trackId: scrollTrack.id,
                    startAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: scrollTrack.id,
                                canvasId: canvas.id,
                                time: 1000,
                                index: 0,
                                position: 0,
                            })
                        )
                    ).id,
                    endAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: scrollTrack.id,
                                canvasId: canvas.id,
                                time: 2000,
                                index: 0,
                                position: 24,
                            })
                        )
                    ).id,
                })
            );
            await dataSource.manager.save(
                new Scroll({
                    trackId: otherTrack.id,
                    startAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: otherTrack.id,
                                canvasId: canvas.id,
                                time: 500,
                                index: 0,
                                position: 10,
                            })
                        )
                    ).id,
                    endAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: otherTrack.id,
                                canvasId: canvas.id,
                                time: 1500,
                                index: 0,
                                position: 20,
                            })
                        )
                    ).id,
                })
            );
            const scrollsService = new ScrollsService(new ScrollRepository(dataSource), new AnchorRepository(dataSource));

            const result = await scrollsService.list({ trackId: scrollTrack.id });

            assert.deepEqual(result, {
                items: [
                    {
                        id: earlierScroll.id,
                        trackId: scrollTrack.id,
                        startAnchorId: earlierScroll.startAnchorId,
                        endAnchorId: earlierScroll.endAnchorId,
                        canvasId: canvas.id,
                        startIndex: 0,
                        endIndex: 0,
                        startTime: 1000,
                        endTime: 2000,
                        startPosition: 0,
                        endPosition: 24,
                    },
                    {
                        id: laterScroll.id,
                        trackId: scrollTrack.id,
                        startAnchorId: laterScroll.startAnchorId,
                        endAnchorId: laterScroll.endAnchorId,
                        canvasId: canvas.id,
                        startIndex: 1,
                        endIndex: 1,
                        startTime: 3000,
                        endTime: 6000,
                        startPosition: 30,
                        endPosition: 90,
                    },
                ],
                total: 2,
            });
        } finally {
            await dataSource.destroy();
        }
    });

    it('updates and soft deletes a scroll event by track id', async () => {
        const dataSource = await createScrollsServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Scroll update product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Scroll update episode',
                })
            );
            const scrollTrack = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Scroll update track',
                    type: 'scroll',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const scroll = await dataSource.manager.save(
                new Scroll({
                    trackId: scrollTrack.id,
                    startAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: scrollTrack.id,
                                canvasId: canvas.id,
                                time: 1000,
                                index: 0,
                                position: 10,
                            })
                        )
                    ).id,
                    endAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: scrollTrack.id,
                                canvasId: canvas.id,
                                time: 2000,
                                index: 0,
                                position: 20,
                            })
                        )
                    ).id,
                })
            );
            const nextStartAnchor = await dataSource.manager.save(
                new Anchor({
                    trackId: scrollTrack.id,
                    canvasId: canvas.id,
                    time: 1500,
                    index: 1,
                    position: 30,
                })
            );
            const nextEndAnchor = await dataSource.manager.save(
                new Anchor({
                    trackId: scrollTrack.id,
                    canvasId: canvas.id,
                    time: 3500,
                    index: 2,
                    position: 90,
                })
            );
            const scrollsService = new ScrollsService(new ScrollRepository(dataSource), new AnchorRepository(dataSource));

            await scrollsService.update({
                trackId: scrollTrack.id,
                scrollId: scroll.id,
                startAnchorId: nextStartAnchor.id,
                endAnchorId: nextEndAnchor.id,
            });
            const afterUpdate = await scrollsService.list({ trackId: scrollTrack.id });

            assert.deepEqual(afterUpdate.items, [
                {
                    id: scroll.id,
                    trackId: scrollTrack.id,
                    startAnchorId: nextStartAnchor.id,
                    endAnchorId: nextEndAnchor.id,
                    canvasId: canvas.id,
                    startIndex: 1,
                    endIndex: 2,
                    startTime: 1500,
                    endTime: 3500,
                    startPosition: 30,
                    endPosition: 90,
                },
            ]);

            await scrollsService.delete({ trackId: scrollTrack.id, scrollId: scroll.id });
            const afterDelete = await scrollsService.list({ trackId: scrollTrack.id });
            const anchorsAfterDelete = await dataSource.manager.find(Anchor, {
                where: { trackId: scrollTrack.id },
                withDeleted: true,
            });

            assert.deepEqual(afterDelete, { items: [], total: 0 });
            assert.equal(anchorsAfterDelete.length, 4);
            assert.equal(anchorsAfterDelete.every((anchor) => anchor.deletedAt === null), true);
        } finally {
            await dataSource.destroy();
        }
    });
});
