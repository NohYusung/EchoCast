import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Anchor } from '../../anchors/domain/anchor.entity';
import { Artist } from '../../artists/domain/artist.entity';
import { Audio } from '../../audios/domain/audio.entity';
import { AudioRepository } from '../../audios/repository/audio.repository';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import { Character } from '../../characters/domain/character.entity';
import { CharacterRepository } from '../../characters/repository/characater.repository';
import { Cue } from '../../cues/domain/cue.entity';
import { CueRepository } from '../../cues/repository/cue.repository';
import { Episode } from '../../episodes/domain/episode.entity';
import { EpisodeRepository } from '../../episodes/repository/episode.repository';
import { Media } from '../../medias/domain/media.entity';
import { Product } from '../../products/domain/product.entity';
import { Record as RecordEntity } from '../../records/domain/record.entity';
import { RecordRepository } from '../../records/repository/record.repository';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { ScrollRepository } from '../../scrolls/repository/scroll.repository';
import { Track } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { PlayerService } from './player.service';

describe('PlayerService', () => {
    it('builds a draft and manifest from episode production data', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [
                Anchor,
                Artist,
                Audio,
                CanvasMedia,
                Canvas,
                Character,
                Cue,
                Episode,
                Media,
                Product,
                RecordEntity,
                Scroll,
                Track,
            ],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(
                new Product({
                    title: 'Player test product',
                    coverImageUrl: 'https://assets.example.com/cover.png',
                })
            );
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Player test episode',
                    subTitle: 'manifest',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: '나리',
                    role: 'starring',
                })
            );
            const visualTrack = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Visual',
                    type: 'scroll',
                })
            );
            const dialogueTrack = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Dialogue',
                    type: 'record',
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
                    mediaName: 'visual.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/visual.png',
                })
            );
            const secondMedia = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'visual-2.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/visual-2.png',
                })
            );
            await dataSource.manager.save([
                new CanvasMedia({ canvasId: canvas.id, mediaId: media.id, index: 0 }),
                new CanvasMedia({ canvasId: canvas.id, mediaId: secondMedia.id, index: 1 }),
            ]);
            await dataSource.manager.save(
                new Scroll({
                    trackId: visualTrack.id,
                    startAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: visualTrack.id,
                                canvasId: canvas.id,
                                time: 0,
                                index: 0,
                                position: 0,
                            })
                        )
                    ).id,
                    endAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: visualTrack.id,
                                canvasId: canvas.id,
                                time: 3000,
                                index: 1,
                                position: 80,
                            })
                        )
                    ).id,
                })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    script: '플레이어 테스트 대사',
                    characterId: character.id,
                    trackId: dialogueTrack.id,
                    startTime: 500,
                    endTime: 2500,
                    volume: 0.9,
                })
            );
            const artist = await dataSource.manager.save(new Artist({ name: '성우' }));
            await dataSource.manager.save(
                new RecordEntity({
                    cueId: cue.id,
                    artistId: artist.id,
                    audioUrl: 'https://assets.example.com/record.wav',
                    duration: 1900,
                    volume: 0.8,
                })
            );

            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new CharacterRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const draft = await playerService.getDraft({ episodeId: episode.id });
            const manifest = await playerService.getManifest({ episodeId: episode.id });

            assert.deepEqual(draft.products, [
                {
                    id: String(product.id),
                    title: 'Player test product',
                    coverImageUrl: 'https://assets.example.com/cover.png',
                },
            ]);
            assert.equal(draft.media[0].id, String(media.id));
            assert.equal(draft.media[0].kind, 'image');
            assert.equal(draft.media.some((item) => item.id === String(secondMedia.id)), true);
            assert.equal(Object.hasOwn(draft, 'items'), true);
            assert.equal(draft.items.some((item) => item.kind === 'visual' && item.mediaId === String(media.id)), true);
            assert.equal(
                draft.items.some((item) => item.kind === 'visual' && item.mediaId === String(secondMedia.id)),
                true
            );
            assert.equal(draft.scripts[0].text, '플레이어 테스트 대사');
            assert.equal(draft.scripts[0].id, draft.cues[0].scriptId);
            assert.equal(draft.cues[0].id, String(cue.id));
            assert.equal(draft.records[0].audioUrl, 'https://assets.example.com/record.wav');
            assert.deepEqual(draft.scrolls, [
                {
                    id: '1',
                    trackId: String(visualTrack.id),
                    canvasId: String(canvas.id),
                    startIndex: 0,
                    endIndex: 1,
                    startTime: 0,
                    endTime: 3000,
                    startPosition: 0,
                    endPosition: 80,
                },
            ]);

            assert.equal(manifest.episodeId, String(episode.id));
            assert.equal(manifest.durationMs, 3000);
            assert.equal(manifest.cues[0].approvedRecordUrl, 'https://assets.example.com/record.wav');
            assert.equal(manifest.items.find((item) => item.mediaId === String(media.id))?.canvasId, String(canvas.id));
            assert.equal(manifest.items.find((item) => item.mediaId === String(secondMedia.id))?.index, 1);
            assert.deepEqual(manifest.scrolls, [
                {
                    id: '1',
                    trackId: String(visualTrack.id),
                    canvasId: String(canvas.id),
                    startIndex: 0,
                    endIndex: 1,
                    startTime: 0,
                    endTime: 3000,
                    startPosition: 0,
                    endPosition: 80,
                },
            ]);
            assert.deepEqual(manifest.tts, []);
        } finally {
            await dataSource.destroy();
        }
    });

    it('assigns unique layer ids when a visual track is synthesized from canvases', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [
                Anchor,
                Artist,
                Audio,
                CanvasMedia,
                Canvas,
                Character,
                Cue,
                Episode,
                Media,
                Product,
                RecordEntity,
                Scroll,
                Track,
            ],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Synthetic visual product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Synthetic visual episode',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: '나리',
                    role: 'starring',
                })
            );
            const dialogueTrack = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Dialogue',
                    type: 'record',
                    characterId: character.id,
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'synthetic-visual.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/synthetic-visual.png',
                })
            );
            await dataSource.manager.save(new CanvasMedia({ canvasId: canvas.id, mediaId: media.id, index: 0 }));
            const cue = await dataSource.manager.save(
                new Cue({
                    script: '합성 비주얼 트랙 테스트',
                    characterId: character.id,
                    trackId: dialogueTrack.id,
                    startTime: 0,
                    endTime: 1800,
                })
            );

            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new CharacterRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const manifest = await playerService.getManifest({ episodeId: episode.id });
            const visualTrack = manifest.tracks.find((track) => track.kind === 'visual');
            const manifestDialogueTrack = manifest.tracks.find((track) => track.id === String(dialogueTrack.id));
            const cueItem = manifest.items.find((item) => item.cueId === String(cue.id));

            assert.ok(visualTrack);
            assert.ok(manifestDialogueTrack);
            assert.ok(cueItem);
            assert.equal(visualTrack.layerId, 0);
            assert.equal(manifestDialogueTrack.layerId, 1);
            assert.equal(cueItem.layerId, 1);
        } finally {
            await dataSource.destroy();
        }
    });

    it('orders manifest visual media by canvas media index before assigning playback windows', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [
                Anchor,
                Artist,
                Audio,
                CanvasMedia,
                Canvas,
                Character,
                Cue,
                Episode,
                Media,
                Product,
                RecordEntity,
                Scroll,
                Track,
            ],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Visual order product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Visual order episode',
                })
            );
            const firstCanvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const secondCanvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const firstMedia = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'first.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/first.png',
                })
            );
            const thirdMedia = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'third.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/third.png',
                })
            );
            const secondMedia = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'second.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/second.png',
                })
            );
            await dataSource.manager.save([
                new CanvasMedia({ canvasId: firstCanvas.id, mediaId: firstMedia.id, index: 0 }),
                new CanvasMedia({ canvasId: firstCanvas.id, mediaId: thirdMedia.id, index: 2 }),
                new CanvasMedia({ canvasId: secondCanvas.id, mediaId: secondMedia.id, index: 1 }),
            ]);

            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new CharacterRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const manifest = await playerService.getManifest({ episodeId: episode.id });
            const visualMediaIds = manifest.items.filter((item) => item.kind === 'visual').map((item) => item.mediaId);

            assert.deepEqual(visualMediaIds, [String(firstMedia.id), String(secondMedia.id), String(thirdMedia.id)]);
        } finally {
            await dataSource.destroy();
        }
    });

    it('maps scroll timing to visual media by canvas id and media index when explicit mapping exists', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [
                Anchor,
                Artist,
                Audio,
                CanvasMedia,
                Canvas,
                Character,
                Cue,
                Episode,
                Media,
                Product,
                RecordEntity,
                Scroll,
                Track,
            ],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Explicit scroll map product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Explicit scroll map episode',
                })
            );
            const scrollTrack = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Scroll',
                    type: 'scroll',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const firstMedia = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'first.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/first.png',
                })
            );
            const secondMedia = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'second.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/second.png',
                })
            );
            await dataSource.manager.save([
                new CanvasMedia({ canvasId: canvas.id, mediaId: firstMedia.id, index: 0 }),
                new CanvasMedia({ canvasId: canvas.id, mediaId: secondMedia.id, index: 1 }),
            ]);
            await dataSource.manager.save([
                new Scroll({
                    trackId: scrollTrack.id,
                    startAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: scrollTrack.id,
                                canvasId: canvas.id,
                                time: 1000,
                                index: 1,
                                position: 10,
                            })
                        )
                    ).id,
                    endAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: scrollTrack.id,
                                canvasId: canvas.id,
                                time: 2000,
                                index: 1,
                                position: 20,
                            })
                        )
                    ).id,
                }),
                new Scroll({
                    trackId: scrollTrack.id,
                    startAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: scrollTrack.id,
                                canvasId: canvas.id,
                                time: 7000,
                                index: 0,
                                position: 70,
                            })
                        )
                    ).id,
                    endAnchorId: (
                        await dataSource.manager.save(
                            new Anchor({
                                trackId: scrollTrack.id,
                                canvasId: canvas.id,
                                time: 9000,
                                index: 0,
                                position: 90,
                            })
                        )
                    ).id,
                }),
            ]);
            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new CharacterRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const manifest = await playerService.getManifest({ episodeId: episode.id });
            const visualByMediaId = new Map(
                manifest.items
                    .filter((item) => item.kind === 'visual')
                    .map((item) => [item.mediaId, item])
            );

            assert.equal(visualByMediaId.get(String(firstMedia.id))?.startTime, 7000);
            assert.equal(visualByMediaId.get(String(firstMedia.id))?.endTime, 9000);
            assert.equal(visualByMediaId.get(String(secondMedia.id))?.startTime, 1000);
            assert.equal(visualByMediaId.get(String(secondMedia.id))?.endTime, 2000);
        } finally {
            await dataSource.destroy();
        }
    });
});
