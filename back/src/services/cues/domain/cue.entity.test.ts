import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Anchor } from '../../anchors/domain/anchor.entity';
import { Audio } from '../../audios/domain/audio.entity';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Character } from '../../characters/domain/character.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Media } from '../../medias/domain/media.entity';
import { Product } from '../../products/domain/product.entity';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Track } from '../../tracks/domain/track.entity';
import { Cue } from './cue.entity';

async function createCueEntityDataSource() {
    const dataSource = new DataSource({
        type: 'sqljs',
        entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Scroll, Track],
        synchronize: true,
        logging: false,
    });
    await dataSource.initialize();
    return dataSource;
}

describe('Cue entity', () => {
    it('stores strip positions and canvas media references instead of ttsVoiceId', async () => {
        const dataSource = await createCueEntityDataSource();

        try {
            const metadata = dataSource.getMetadata(Cue);
            const columnNames = metadata.columns.map((column) => column.propertyName);

            assert.equal(columnNames.includes('ttsVoiceId'), false);
            assert.equal(columnNames.includes('startCanvasMediaId'), true);
            assert.equal(columnNames.includes('endCanvasMediaId'), true);
            assert.equal(columnNames.includes('startPosition'), true);
            assert.equal(columnNames.includes('endPosition'), true);
            assert.equal(columnNames.includes('audioStartTime'), true);
            assert.equal(columnNames.includes('audioEndTime'), true);
        } finally {
            await dataSource.destroy();
        }
    });

    it('links cue start and end positions to canvas_media rows', async () => {
        const dataSource = await createCueEntityDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue entity product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue entity episode',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue entity track',
                    type: 'record',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'cue-entity-strip.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/cue-entity-strip.png',
                })
            );
            const canvasMedia = await dataSource.manager.save(
                new CanvasMedia({ canvasId: canvas.id, mediaId: media.id, index: 0 })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    script: '위치가 있는 큐',
                    trackId: track.id,
                    startCanvasMediaId: canvasMedia.id,
                    endCanvasMediaId: canvasMedia.id,
                    startTime: 1000,
                    endTime: 2000,
                    startPosition: 10,
                    endPosition: 70,
                })
            );

            const storedCue = await dataSource.manager.findOneOrFail(Cue, {
                where: { id: cue.id },
                relations: { startCanvasMedia: true, endCanvasMedia: true },
            });

            assert.equal(storedCue.startCanvasMediaId, canvasMedia.id);
            assert.equal(storedCue.endCanvasMediaId, canvasMedia.id);
            assert.equal(storedCue.startCanvasMedia?.id, canvasMedia.id);
            assert.equal(storedCue.endCanvasMedia?.id, canvasMedia.id);
            assert.equal(storedCue.startPosition, 10);
            assert.equal(storedCue.endPosition, 70);
        } finally {
            await dataSource.destroy();
        }
    });
});
