import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Character } from '../../characters/domain/character.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Media } from '../../medias/domain/media.entity';
import { Product } from '../../products/domain/product.entity';
import { CanvasMedia } from './canvas-media.entity';

describe('CanvasMedia', () => {
    it('stores canvas-specific media ordering on the relation entity', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [CanvasMedia, Canvas, Character, Episode, Media, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const columnNames = dataSource.getMetadata(CanvasMedia).columns.map((column) => column.propertyName);

            assert.equal(columnNames.includes('canvasId'), true);
            assert.equal(columnNames.includes('mediaId'), true);
            assert.equal(columnNames.includes('index'), true);
            assert.equal(columnNames.includes('startTime'), true);
            assert.equal(columnNames.includes('endTime'), true);
            assert.equal(columnNames.includes('sourceStartTime'), true);
            assert.equal(columnNames.includes('sourceEndTime'), true);
            assert.equal(columnNames.includes('volume'), true);
            assert.equal(columnNames.includes('isMuted'), true);

            const product = await dataSource.manager.save(new Product({ title: 'CanvasMedia product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'CanvasMedia episode',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'canvas-media.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/canvas-media.png',
                })
            );

            const canvasMedia = await dataSource.manager.save(
                new CanvasMedia({
                    canvasId: canvas.id,
                    mediaId: media.id,
                    index: 2,
                    startTime: 1000,
                    endTime: 4200,
                    sourceStartTime: 500,
                    sourceEndTime: 3700,
                    volume: 0.65,
                    isMuted: true,
                })
            );

            assert.equal(canvasMedia.index, 2);
            assert.equal(canvasMedia.startTime, 1000);
            assert.equal(canvasMedia.endTime, 4200);
            assert.equal(canvasMedia.sourceStartTime, 500);
            assert.equal(canvasMedia.sourceEndTime, 3700);
            assert.equal(canvasMedia.volume, 0.65);
            assert.equal(canvasMedia.isMuted, true);
        } finally {
            await dataSource.destroy();
        }
    });
});
