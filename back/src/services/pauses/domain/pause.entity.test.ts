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
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Track } from '../../tracks/domain/track.entity';
import { Pause } from './pause.entity';

describe('Pause', () => {
    it('stores a duration and anchor reference for fixed scroll position pauses', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Pause, Product, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const columnNames = dataSource.getMetadata(Pause).columns.map((column) => column.propertyName);

            assert.equal(columnNames.includes('trackId'), true);
            assert.equal(columnNames.includes('anchorId'), true);
            assert.equal(columnNames.includes('duration'), true);
            assert.equal(columnNames.includes('canvasId'), false);
            assert.equal(columnNames.includes('index'), false);
            assert.equal(columnNames.includes('time'), false);
            assert.equal(columnNames.includes('position'), false);
        } finally {
            await dataSource.destroy();
        }
    });

    it('derives fixed scroll geometry from the referenced anchor', () => {
        const anchor = new Anchor({
            trackId: 3,
            canvasId: 9,
            time: 1200,
            index: 2,
            position: 45,
        });
        const pause = new Pause({
            trackId: 3,
            anchorId: 7,
            duration: 1500,
        });

        pause.anchor = anchor;

        assert.equal(pause.canvasId, 9);
        assert.equal(pause.index, 2);
        assert.equal(pause.time, 1200);
        assert.equal(pause.position, 45);
    });
});
