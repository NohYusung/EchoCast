import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Character } from '../../characters/domain/character.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Product } from '../../products/domain/product.entity';
import { Media } from './media.entity';

describe('Media', () => {
    it('does not store canvas ordering on the media entity', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [CanvasMedia, Canvas, Character, Episode, Media, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const columnNames = dataSource.getMetadata(Media).columns.map((column) => column.propertyName);

            assert.equal(columnNames.includes('index'), false);
        } finally {
            await dataSource.destroy();
        }
    });
});
