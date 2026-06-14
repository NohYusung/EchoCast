import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Track } from '../../tracks/domain/track.entity';
import { Pause } from '../domain/pause.entity';
import { PauseRepository } from '../repository/pause.repository';
import { PauseService } from './pause.service';

async function createPauseServiceDataSource() {
    const dataSource = new DataSource({
        type: 'sqljs',
        entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Pause, Product, Scroll, Track],
        synchronize: true,
        logging: false,
    });
    await dataSource.initialize();
    return dataSource;
}

async function createTrackAnchor(dataSource: DataSource, {
    trackName,
    time,
    index,
    position,
}: {
    trackName: string;
    time: number;
    index: number;
    position: number;
}) {
    const product = await dataSource.manager.save(new Product({ title: `${trackName} product` }));
    const episode = await dataSource.manager.save(
        new Episode({
            productId: product.id,
            episodeNumber: 1,
            title: `${trackName} episode`,
        })
    );
    const track = await dataSource.manager.save(
        new Track({
            episodeId: episode.id,
            name: trackName,
            type: 'scroll',
        })
    );
    const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
    const anchor = await dataSource.manager.save(
        new Anchor({
            trackId: track.id,
            canvasId: canvas.id,
            time,
            index,
            position,
        })
    );

    return { anchor, canvas, track };
}

describe('PauseService', () => {
    it('creates and lists pause events ordered by anchor time', async () => {
        const dataSource = await createPauseServiceDataSource();

        try {
            const { anchor: laterAnchor, canvas, track } = await createTrackAnchor(dataSource, {
                trackName: 'Pause list track',
                time: 4000,
                index: 2,
                position: 80,
            });
            const earlierAnchor = await dataSource.manager.save(
                new Anchor({
                    trackId: track.id,
                    canvasId: canvas.id,
                    time: 1000,
                    index: 0,
                    position: 20,
                })
            );
            const pauseService = new PauseService(new PauseRepository(dataSource), new AnchorRepository(dataSource));

            const laterPause = await pauseService.create({
                trackId: track.id,
                anchorId: laterAnchor.id,
                duration: 2000,
            });
            const earlierPause = await pauseService.create({
                trackId: track.id,
                anchorId: earlierAnchor.id,
                duration: 1000,
            });
            const result = await pauseService.list({ trackId: track.id });

            assert.deepEqual(laterPause, {
                id: laterPause.id,
                trackId: track.id,
                anchorId: laterAnchor.id,
                duration: 2000,
                canvasId: canvas.id,
                index: 2,
                time: 4000,
                position: 80,
            });
            assert.deepEqual(result, {
                items: [
                    {
                        id: earlierPause.id,
                        trackId: track.id,
                        anchorId: earlierAnchor.id,
                        duration: 1000,
                        canvasId: canvas.id,
                        index: 0,
                        time: 1000,
                        position: 20,
                    },
                    {
                        id: laterPause.id,
                        trackId: track.id,
                        anchorId: laterAnchor.id,
                        duration: 2000,
                        canvasId: canvas.id,
                        index: 2,
                        time: 4000,
                        position: 80,
                    },
                ],
                total: 2,
            });
        } finally {
            await dataSource.destroy();
        }
    });

    it('updates and soft deletes a pause event by track id', async () => {
        const dataSource = await createPauseServiceDataSource();

        try {
            const { anchor, canvas, track } = await createTrackAnchor(dataSource, {
                trackName: 'Pause update track',
                time: 1000,
                index: 0,
                position: 10,
            });
            const nextAnchor = await dataSource.manager.save(
                new Anchor({
                    trackId: track.id,
                    canvasId: canvas.id,
                    time: 3000,
                    index: 1,
                    position: 60,
                })
            );
            const pause = await dataSource.manager.save(
                new Pause({
                    trackId: track.id,
                    anchorId: anchor.id,
                    duration: 1000,
                })
            );
            const pauseService = new PauseService(new PauseRepository(dataSource), new AnchorRepository(dataSource));

            await pauseService.update({
                trackId: track.id,
                pauseId: pause.id,
                anchorId: nextAnchor.id,
                duration: 2500,
            });

            const updatedPause = await dataSource.manager.findOneByOrFail(Pause, { id: pause.id });

            assert.equal(updatedPause.anchorId, nextAnchor.id);
            assert.equal(updatedPause.duration, 2500);

            await pauseService.delete({ trackId: track.id, pauseId: pause.id });

            const result = await pauseService.list({ trackId: track.id });

            assert.deepEqual(result, { items: [], total: 0 });
        } finally {
            await dataSource.destroy();
        }
    });

    it('rejects invalid durations and anchors outside the target track', async () => {
        const dataSource = await createPauseServiceDataSource();

        try {
            const { anchor, track } = await createTrackAnchor(dataSource, {
                trackName: 'Pause validation track',
                time: 1000,
                index: 0,
                position: 10,
            });
            const { anchor: otherTrackAnchor } = await createTrackAnchor(dataSource, {
                trackName: 'Pause other track',
                time: 2000,
                index: 0,
                position: 20,
            });
            const pauseService = new PauseService(new PauseRepository(dataSource), new AnchorRepository(dataSource));

            await assert.rejects(
                () =>
                    pauseService.create({
                        trackId: track.id,
                        anchorId: anchor.id,
                        duration: 0,
                    }),
                BadRequestException
            );
            await assert.rejects(
                () =>
                    pauseService.create({
                        trackId: track.id,
                        anchorId: otherTrackAnchor.id,
                        duration: 1000,
                    }),
                BadRequestException
            );
            await assert.rejects(
                () =>
                    pauseService.update({
                        trackId: track.id,
                        pauseId: 999999,
                        duration: 1000,
                    }),
                NotFoundException
            );
        } finally {
            await dataSource.destroy();
        }
    });
});
