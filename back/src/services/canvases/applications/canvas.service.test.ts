import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
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
            entities: [Canvas, Character, Episode, Media, Product],
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
                    canvasId: canvas.id,
                    mediaName: 'canvas.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/canvas.png',
                    index: 0,
                })
            );
            const secondMedia = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    canvasId: canvas.id,
                    mediaName: 'canvas-2.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/canvas-2.png',
                    index: 1,
                })
            );
            const canvasRepository = new CanvasRepository(dataSource);
            const mediaRepository = new MediaRepository(dataSource);
            const canvasService = new CanvasService(canvasRepository, mediaRepository);

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
            entities: [Canvas, Character, Episode, Media, Product],
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
            const canvasService = new CanvasService(canvasRepository, mediaRepository);
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'confirmed-composition.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/confirmed-composition.png',
                    index: 9,
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
                { relations: { medias: true } }
            );

            assert.ok(storedCanvas);
            assert.equal(storedCanvas.medias.length, 1);
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
});
