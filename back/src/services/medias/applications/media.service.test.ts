import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import { Character } from '../../characters/domain/character.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Product } from '../../products/domain/product.entity';
import { Media } from '../domain/media.entity';
import { MediaRepository } from '../repository/media.repository';
import { MediaService } from './media.service';

describe('MediaService', () => {
    it('creates media without creating a canvas and soft deletes it from the episode media list', async () => {
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
                    title: 'Media test product',
                })
            );
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Media test episode',
                })
            );
            const mediaRepository = new MediaRepository(dataSource);
            const canvasRepository = new CanvasRepository(dataSource);
            const mediaService = new MediaService(mediaRepository);
            const createdMedia = await mediaService.create({
                episodeId: episode.id,
                mediaType: 'image',
                mediaUrl: 'https://assets.example.com/media.png',
                index: 0,
            });
            const createdMediaList = await mediaService.list({ episodeId: episode.id });
            const remainingCanvases = await canvasRepository.find({
                episodeId: episode.id,
            });

            assert.deepEqual(createdMediaList, {
                items: [
                    {
                        id: createdMedia.id,
                        episodeId: episode.id,
                        canvasId: undefined,
                        mediaType: 'image',
                        mediaUrl: 'https://assets.example.com/media.png',
                        index: 0,
                    },
                ],
                total: 1,
            });
            assert.deepEqual(remainingCanvases, []);

            await mediaService.delete({ episodeId: episode.id, mediaId: createdMedia.id });

            const mediaList = await mediaService.list({ episodeId: episode.id });

            assert.deepEqual(mediaList, { items: [], total: 0 });
            assert.deepEqual(await mediaRepository.find({ id: createdMedia.id }), []);
        } finally {
            await dataSource.destroy();
        }
    });

    it('throws NotFoundException when the media is not registered in the episode', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Canvas, Character, Episode, Media, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const mediaRepository = new MediaRepository(dataSource);
            const mediaService = new MediaService(mediaRepository);

            await assert.rejects(
                () => mediaService.delete({ episodeId: 1, mediaId: 1 }),
                (error: unknown) => error instanceof NotFoundException
            );
        } finally {
            await dataSource.destroy();
        }
    });
});
