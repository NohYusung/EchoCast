import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Anchor } from '../../anchors/domain/anchor.entity';
import { Audio } from '../../audios/domain/audio.entity';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Character } from '../../characters/domain/character.entity';
import { Cue } from '../../cues/domain/cue.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Media } from '../../medias/domain/media.entity';
import { Product } from '../../products/domain/product.entity';
import { Track } from '../../tracks/domain/track.entity';
import { Scroll } from './scroll.entity';

describe('Scroll', () => {
    it('stores only anchor references for scroll start and end geometry', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const columnNames = dataSource.getMetadata(Scroll).columns.map((column) => column.propertyName);

            assert.equal(columnNames.includes('startAnchorId'), true);
            assert.equal(columnNames.includes('endAnchorId'), true);
            assert.equal(columnNames.includes('canvasId'), false);
            assert.equal(columnNames.includes('startIndex'), false);
            assert.equal(columnNames.includes('endIndex'), false);
            assert.equal(columnNames.includes('startTime'), false);
            assert.equal(columnNames.includes('endTime'), false);
            assert.equal(columnNames.includes('startPosition'), false);
            assert.equal(columnNames.includes('endPosition'), false);
            assert.equal('canvasId' in Scroll.prototype, false);
            assert.equal('startIndex' in Scroll.prototype, false);
            assert.equal('endIndex' in Scroll.prototype, false);
            assert.equal('startTime' in Scroll.prototype, false);
            assert.equal('endTime' in Scroll.prototype, false);
            assert.equal('startPosition' in Scroll.prototype, false);
            assert.equal('endPosition' in Scroll.prototype, false);
        } finally {
            await dataSource.destroy();
        }
    });
});
