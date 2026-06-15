import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Context } from '../../../common/context';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import { Character } from '../../characters/domain/character.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Product } from '../../products/domain/product.entity';
import { Media } from '../domain/media.entity';
import { MediaRepository } from '../repository/media.repository';
import { MediaService } from './media.service';

function createMediaService(dataSource: DataSource) {
    const context = new Context();
    const mediaRepository = new MediaRepository(dataSource, context);
    const mediaService = new MediaService(mediaRepository);

    mediaService.entityManager = dataSource.manager;
    mediaService.context = context;

    return { mediaRepository, mediaService };
}

describe('MediaService', () => {
    it('creates media without creating a canvas and soft deletes it from the episode media list', async () => {
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
            const { mediaRepository, mediaService } = createMediaService(dataSource);
            const canvasRepository = new CanvasRepository(dataSource);
            const createResult = await mediaService.create({
                episodeId: episode.id,
                mediaName: 'media.png',
                mediaType: 'image',
                mediaUrl: 'https://assets.example.com/media.png',
            });
            const createdMediaList = await mediaService.list({ episodeId: episode.id });
            const remainingCanvases = await canvasRepository.find({
                episodeId: episode.id,
            });

            assert.equal(createResult, undefined);
            assert.deepEqual(createdMediaList, {
                items: [
                    {
                        id: createdMediaList.items[0].id,
                        episodeId: episode.id,
                        canvasId: undefined,
                        mediaName: 'media.png',
                        mediaType: 'image',
                        mediaUrl: 'https://assets.example.com/media.png',
                    },
                ],
                total: 1,
            });
            assert.deepEqual(remainingCanvases, []);

            await mediaService.delete({ episodeId: episode.id, mediaId: createdMediaList.items[0].id });

            const mediaList = await mediaService.list({ episodeId: episode.id });

            assert.deepEqual(mediaList, { items: [], total: 0 });
            assert.deepEqual(await mediaRepository.find({ id: createdMediaList.items[0].id }), []);
        } finally {
            await dataSource.destroy();
        }
    });

    it('stores video duration when media is registered as a video', async () => {
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
                    title: 'Media video duration product',
                })
            );
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Media video duration episode',
                })
            );
            const { mediaService } = createMediaService(dataSource);

            await mediaService.create({
                episodeId: episode.id,
                mediaName: 'clip.mp4',
                mediaType: 'video',
                mediaUrl: 'https://assets.example.com/clip.mp4',
                duration: 2400,
            });

            const mediaList = await mediaService.list({ episodeId: episode.id });

            assert.deepEqual(mediaList.items, [
                {
                    id: mediaList.items[0].id,
                    episodeId: episode.id,
                    canvasId: undefined,
                    mediaName: 'clip.mp4',
                    mediaType: 'video',
                    mediaUrl: 'https://assets.example.com/clip.mp4',
                    duration: 2400,
                },
            ]);
        } finally {
            await dataSource.destroy();
        }
    });

    it('throws NotFoundException when the media is not registered in the episode', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [CanvasMedia, Canvas, Character, Episode, Media, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const { mediaService } = createMediaService(dataSource);

            await assert.rejects(
                () => mediaService.delete({ episodeId: 1, mediaId: 1 }),
                (error: unknown) => error instanceof NotFoundException
            );
        } finally {
            await dataSource.destroy();
        }
    });
});
