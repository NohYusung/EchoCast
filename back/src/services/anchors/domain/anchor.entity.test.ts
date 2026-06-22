import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Audio } from '../../audios/domain/audio.entity';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Character } from '../../characters/domain/character.entity';
import { Cue } from '../../cues/domain/cue.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Media } from '../../medias/domain/media.entity';
import { Product } from '../../products/domain/product.entity';
import { Script } from '../../scripts/domain/script.entity';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Track } from '../../tracks/domain/track.entity';
import { Anchor } from './anchor.entity';

describe('Anchor', () => {
    it('stores timeline time and media-local position with track and canvas relations', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Script, Scroll, Track],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Anchor test product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Anchor test episode',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Anchor scroll track',
                    type: 'scroll',
                })
            );

            const anchor = await dataSource.manager.save(
                new Anchor({
                    trackId: track.id,
                    canvasId: canvas.id,
                    time: 1200,
                    index: 2,
                    position: 37.5,
                })
            );

            const storedAnchor = await dataSource.manager.findOneOrFail(Anchor, {
                where: { id: anchor.id },
                relations: { track: true, canvas: true },
            });

            assert.equal(storedAnchor.trackId, track.id);
            assert.equal(storedAnchor.canvasId, canvas.id);
            assert.equal(storedAnchor.track.id, track.id);
            assert.equal(storedAnchor.canvas.id, canvas.id);
            assert.equal(storedAnchor.time, 1200);
            assert.equal(storedAnchor.index, 2);
            assert.equal(storedAnchor.position, 37.5);

            storedAnchor.update({
                time: 1800,
                index: 3,
                position: 62.25,
            });
            await dataSource.manager.save(storedAnchor);

            const updatedAnchor = await dataSource.manager.findOneByOrFail(Anchor, { id: anchor.id });

            assert.equal(updatedAnchor.time, 1800);
            assert.equal(updatedAnchor.index, 3);
            assert.equal(updatedAnchor.position, 62.25);
        } finally {
            await dataSource.destroy();
        }
    });
});
