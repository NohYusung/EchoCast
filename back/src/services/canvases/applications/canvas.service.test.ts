import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { CanvasMediaRepository } from '../../canvas-medias/repository/canvas-media.repository';
import { Character } from '../../characters/domain/character.entity';
import { Canvas } from '../domain/canvas.entity';
import { CanvasRepository } from '../repository/canvas.repository';
import { CanvasService } from './canvas.service';
import { Episode } from '../../episodes/domain/episode.entity';
import { Media } from '../../medias/domain/media.entity';
import { MediaRepository } from '../../medias/repository/media.repository';
import { Product } from '../../products/domain/product.entity';

describe('CanvasService', () => {
    it('lists canvases for an episode with media metadata', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [CanvasMedia, Canvas, Character, Episode, Media, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(
                new Product({
                    title: 'Canvas test product',
                })
            );
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Canvas test episode',
                })
            );
            const canvas = await dataSource.manager.save(
                new Canvas({
                    episodeId: episode.id,
                })
            );
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'canvas.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/canvas.png',
                })
            );
            const secondMedia = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'canvas-2.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/canvas-2.png',
                })
            );
            await dataSource.manager.save([
                new CanvasMedia({ canvasId: canvas.id, mediaId: media.id, index: 0 }),
                new CanvasMedia({ canvasId: canvas.id, mediaId: secondMedia.id, index: 1 }),
            ]);
            const canvasRepository = new CanvasRepository(dataSource);
            const mediaRepository = new MediaRepository(dataSource);
            const canvasMediaRepository = new CanvasMediaRepository(dataSource);
            const canvasService = new CanvasService(canvasRepository, mediaRepository, canvasMediaRepository);

            const result = await canvasService.list({ episodeId: episode.id });

            assert.deepEqual(result, {
                items: [
                    {
                        id: canvas.id,
                        episodeId: episode.id,
                        mediaId: media.id,
                        mediaName: 'canvas.png',
                        mediaType: 'image',
                        mediaUrl: 'https://assets.example.com/canvas.png',
                        index: 0,
                        medias: [
                            {
                                mediaId: media.id,
                                mediaName: 'canvas.png',
                                mediaType: 'image',
                                mediaUrl: 'https://assets.example.com/canvas.png',
                                index: 0,
                            },
                            {
                                mediaId: secondMedia.id,
                                mediaName: 'canvas-2.png',
                                mediaType: 'image',
                                mediaUrl: 'https://assets.example.com/canvas-2.png',
                                index: 1,
                            },
                        ],
                    },
                ],
                total: 1,
            });
        } finally {
            await dataSource.destroy();
        }
    });

    it('creates a canvas with attached media items', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [CanvasMedia, Canvas, Character, Episode, Media, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(
                new Product({
                    title: 'Canvas create product',
                })
            );
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Canvas create episode',
                })
            );
            const canvasRepository = new CanvasRepository(dataSource);
            const mediaRepository = new MediaRepository(dataSource);
            const canvasMediaRepository = new CanvasMediaRepository(dataSource);
            const canvasService = new CanvasService(canvasRepository, mediaRepository, canvasMediaRepository);
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'confirmed-composition.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/confirmed-composition.png',
                })
            );

            const result = await canvasService.create({
                episodeId: episode.id,
                medias: [
                    {
                        mediaId: media.id,
                        index: 0,
                    },
                ],
            });

            const [storedCanvas] = await canvasRepository.find(
                { id: result.id, episodeId: episode.id },
                { relations: { canvasMedias: { media: true } } }
            );

            assert.ok(storedCanvas);
            assert.equal(storedCanvas.canvasMedias.length, 1);
            assert.equal(await mediaRepository.countByEpisodeId(episode.id), 1);
            assert.deepEqual(result, {
                id: storedCanvas.id,
                episodeId: episode.id,
                medias: [
                    {
                        id: media.id,
                        episodeId: episode.id,
                        canvasId: storedCanvas.id,
                        mediaName: 'confirmed-composition.png',
                        mediaType: 'image',
                        mediaUrl: 'https://assets.example.com/confirmed-composition.png',
                        index: 0,
                    },
                ],
            });
        } finally {
            await dataSource.destroy();
        }
    });

    it('creates a canvas with attached video media metadata', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [CanvasMedia, Canvas, Character, Episode, Media, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(
                new Product({
                    title: 'Canvas video product',
                })
            );
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Canvas video episode',
                })
            );
            const canvasRepository = new CanvasRepository(dataSource);
            const mediaRepository = new MediaRepository(dataSource);
            const canvasMediaRepository = new CanvasMediaRepository(dataSource);
            const canvasService = new CanvasService(canvasRepository, mediaRepository, canvasMediaRepository);
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'confirmed-video.mp4',
                    mediaType: 'video',
                    mediaUrl: 'https://assets.example.com/confirmed-video.mp4',
                    duration: 2400,
                })
            );

            const result = await canvasService.create({
                episodeId: episode.id,
                medias: [
                    {
                        mediaId: media.id,
                        index: 0,
                    },
                ],
            });

            assert.deepEqual(result.medias, [
                {
                    id: media.id,
                    episodeId: episode.id,
                    canvasId: result.id,
                    mediaName: 'confirmed-video.mp4',
                    mediaType: 'video',
                    mediaUrl: 'https://assets.example.com/confirmed-video.mp4',
                    duration: 2400,
                    index: 0,
                },
            ]);
        } finally {
            await dataSource.destroy();
        }
    });

    it('keeps canvas media indexes independent when the same media is attached to multiple canvases', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [CanvasMedia, Canvas, Character, Episode, Media, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(
                new Product({
                    title: 'Canvas multi attach product',
                })
            );
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Canvas multi attach episode',
                })
            );
            const canvasRepository = new CanvasRepository(dataSource);
            const mediaRepository = new MediaRepository(dataSource);
            const canvasMediaRepository = new CanvasMediaRepository(dataSource);
            const canvasService = new CanvasService(canvasRepository, mediaRepository, canvasMediaRepository);
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'shared.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/shared.png',
                })
            );

            await canvasService.create({
                episodeId: episode.id,
                medias: [{ mediaId: media.id, index: 0 }],
            });
            await canvasService.create({
                episodeId: episode.id,
                medias: [{ mediaId: media.id, index: 3 }],
            });

            const result = await canvasService.list({ episodeId: episode.id });

            assert.equal(result.total, 2);
            assert.deepEqual(
                result.items.map((item) =>
                    item.medias.map((mediaItem) => ({ mediaId: mediaItem.mediaId, index: mediaItem.index }))
                ),
                [
                    [{ mediaId: media.id, index: 0 }],
                    [{ mediaId: media.id, index: 3 }],
                ]
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('updates an existing canvas by replacing attached media items', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [CanvasMedia, Canvas, Character, Episode, Media, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(
                new Product({
                    title: 'Canvas update product',
                })
            );
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Canvas update episode',
                })
            );
            const canvasRepository = new CanvasRepository(dataSource);
            const mediaRepository = new MediaRepository(dataSource);
            const canvasMediaRepository = new CanvasMediaRepository(dataSource);
            const canvasService = new CanvasService(canvasRepository, mediaRepository, canvasMediaRepository);
            const firstMedia = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'first.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/first.png',
                })
            );
            const secondMedia = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'second.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/second.png',
                })
            );
            const created = await canvasService.create({
                episodeId: episode.id,
                medias: [{ mediaId: firstMedia.id, index: 0 }],
            });

            await canvasService.update({
                episodeId: episode.id,
                canvasId: created.id,
                medias: [
                    { mediaId: secondMedia.id, index: 0 },
                    { mediaId: firstMedia.id, index: 1 },
                ],
            });

            const result = await canvasService.list({ episodeId: episode.id });

            assert.equal(result.total, 1);
            assert.deepEqual(result.items[0].medias, [
                {
                    mediaId: secondMedia.id,
                    mediaName: 'second.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/second.png',
                    index: 0,
                },
                {
                    mediaId: firstMedia.id,
                    mediaName: 'first.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/first.png',
                    index: 1,
                },
            ]);
        } finally {
            await dataSource.destroy();
        }
    });
});
