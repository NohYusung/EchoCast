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
            const canvasRepository = new CanvasRepository(dataSource);
            const canvasService = new CanvasService(canvasRepository);

            const result = await canvasService.list({ episodeId: episode.id });

            assert.deepEqual(result, {
                items: [
                    {
                        id: canvas.id,
                        episodeId: episode.id,
                        mediaId: media.id,
                        mediaType: 'image',
                        mediaUrl: 'https://assets.example.com/canvas.png',
                        index: 0,
                    },
                ],
                total: 1,
            });
        } finally {
            await dataSource.destroy();
        }
    });
});
