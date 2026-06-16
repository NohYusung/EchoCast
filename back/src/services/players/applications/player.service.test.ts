import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Anchor } from '../../anchors/domain/anchor.entity';
import { AnchorRepository } from '../../anchors/repository/anchor.repository';
import { Artist } from '../../artists/domain/artist.entity';
import { Audio } from '../../audios/domain/audio.entity';
import { AudioRepository } from '../../audios/repository/audio.repository';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import { Character } from '../../characters/domain/character.entity';
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

async function setDefaultCanvas(dataSource: DataSource, episode: Episode, canvas: Canvas) {
    episode.defaultCanvasId = canvas.id;
    await dataSource.manager.save(episode);
}

describe('PlayerService', () => {
    it('builds player info from episode production data', async () => {
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
            await setDefaultCanvas(dataSource, episode, canvas);
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
                    recordUrl: 'https://assets.example.com/record-draft.wav',
                    duration: 1900,
                    volume: 0.8,
                    isAccepted: false,
                })
            );
            await dataSource.manager.save(
                new RecordEntity({
                    cueId: cue.id,
                    artistId: artist.id,
                    recordUrl: 'https://assets.example.com/record.wav',
                    duration: 1700,
                    volume: 0.7,
                    isAccepted: true,
                })
            );

            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new AnchorRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const playerInfo = await playerService.getPlayerInfo({ episodeId: episode.id });

            assert.equal(playerInfo.episodeId, episode.id);
            assert.equal(playerInfo.totalDuration, 3000);
            assert.equal(playerInfo.media[0].id, media.id);
            assert.equal(playerInfo.media[0].kind, 'image');
            assert.equal(playerInfo.media.some((item) => item.id === secondMedia.id), true);
            assert.equal(playerInfo.items.some((item) => item.kind === 'visual' && item.mediaId === media.id), true);
            assert.equal(
                playerInfo.items.some((item) => item.kind === 'visual' && item.mediaId === secondMedia.id),
                true
            );
            assert.equal(playerInfo.cues[0].id, cue.id);
            assert.equal(playerInfo.cues[0].approvedRecordUrl, 'https://assets.example.com/record.wav');
            assert.equal(playerInfo.records[0].recordUrl, 'https://assets.example.com/record-draft.wav');
            assert.equal(playerInfo.records[0].isAccepted, false);
            assert.equal(playerInfo.records[1].recordUrl, 'https://assets.example.com/record.wav');
            assert.equal(playerInfo.records[1].isAccepted, true);
            assert.equal(playerInfo.items.find((item) => item.mediaId === media.id)?.canvasId, canvas.id);
            assert.equal(playerInfo.items.find((item) => item.mediaId === secondMedia.id)?.index, 1);
            const playerCanvasManifest = playerInfo as typeof playerInfo & {
                previewCanvasId?: number;
                canvases?: Array<{
                    id: number;
                    episodeId: number;
                    mediaId?: number;
                    mediaName?: string;
                    mediaType?: string;
                    mediaUrl?: string;
                    canvasMediaId?: number;
                    index?: number;
                    medias?: Array<{
                        canvasMediaId?: number;
                        mediaId: number;
                        mediaName?: string;
                        mediaType?: string;
                        mediaUrl?: string;
                        index?: number;
                    }>;
                }>;
            };
            assert.equal(playerCanvasManifest.previewCanvasId, canvas.id);
            assert.equal(playerCanvasManifest.canvases?.[0]?.id, canvas.id);
            assert.equal(playerCanvasManifest.canvases?.[0]?.episodeId, episode.id);
            assert.equal(playerCanvasManifest.canvases?.[0]?.mediaId, media.id);
            assert.equal(playerCanvasManifest.canvases?.[0]?.mediaName, 'visual.png');
            assert.equal(playerCanvasManifest.canvases?.[0]?.mediaType, 'image');
            assert.equal(playerCanvasManifest.canvases?.[0]?.mediaUrl, 'https://assets.example.com/visual.png');
            assert.deepEqual(
                playerCanvasManifest.canvases?.[0]?.medias?.map((item) => ({
                    mediaId: item.mediaId,
                    mediaName: item.mediaName,
                    mediaType: item.mediaType,
                    mediaUrl: item.mediaUrl,
                    index: item.index,
                })),
                [
                    {
                        mediaId: media.id,
                        mediaName: 'visual.png',
                        mediaType: 'image',
                        mediaUrl: 'https://assets.example.com/visual.png',
                        index: 0,
                    },
                    {
                        mediaId: secondMedia.id,
                        mediaName: 'visual-2.png',
                        mediaType: 'image',
                        mediaUrl: 'https://assets.example.com/visual-2.png',
                        index: 1,
                    },
                ]
            );
            assert.deepEqual(playerInfo.scrolls, [
                {
                    id: 1,
                    trackId: visualTrack.id,
                    canvasId: canvas.id,
                    startIndex: 0,
                    endIndex: 1,
                    startTime: 0,
                    endTime: 3000,
                    startPosition: 0,
                    endPosition: 80,
                },
            ]);
            assert.deepEqual(playerInfo.tts, []);
        } finally {
            await dataSource.destroy();
        }
    });

    it('throws when an episode has no default canvas for player playback', async () => {
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
            const product = await dataSource.manager.save(new Product({ title: 'New authoring product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'New authoring episode',
                })
            );
            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new AnchorRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            await assert.rejects(
                () => playerService.getPlayerInfo({ episodeId: episode.id }),
                /대표 캔버스를 찾을 수 없습니다./
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('does not synthesize a normalized visual track from canvases', async () => {
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
            await setDefaultCanvas(dataSource, episode, canvas);
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
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new AnchorRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const manifest = await playerService.getPlayerInfo({ episodeId: episode.id });
            const manifestDialogueTrack = manifest.tracks.find((track) => track.id === dialogueTrack.id);
            const cueItem = manifest.items.find((item) => item.cueId === cue.id);
            const visualItem = manifest.items.find((item) => item.kind === 'visual');

            assert.equal(manifest.tracks.some((track) => (track.kind as string) === 'visual'), false);
            assert.ok(manifestDialogueTrack);
            assert.ok(cueItem);
            assert.ok(visualItem);
            assert.equal(manifestDialogueTrack.kind, 'record');
            assert.equal(manifestDialogueTrack.layerId, 0);
            assert.equal(cueItem.layerId, 0);
            assert.equal(visualItem.trackId, undefined);
        } finally {
            await dataSource.destroy();
        }
    });

    it('throws when selected canvas media has no index', async () => {
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
            const product = await dataSource.manager.save(new Product({ title: 'Missing canvas media index product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Missing canvas media index episode',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            await setDefaultCanvas(dataSource, episode, canvas);
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'missing-index.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/missing-index.png',
                })
            );
            const canvasMedia = await dataSource.manager.save(new CanvasMedia({ canvasId: canvas.id, mediaId: media.id }));
            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new AnchorRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            await assert.rejects(
                () => playerService.getPlayerInfo({ episodeId: episode.id }),
                new RegExp(`CanvasMedia index가 누락되었습니다. canvasMediaId=${canvasMedia.id}`)
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('uses the default canvas unless a player canvas filter is provided', async () => {
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
            await setDefaultCanvas(dataSource, episode, firstCanvas);
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
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new AnchorRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const manifest = await playerService.getPlayerInfo({ episodeId: episode.id });
            const filteredManifest = await playerService.getPlayerInfo({ episodeId: episode.id, canvasId: secondCanvas.id });
            const visualMediaIds = manifest.items.filter((item) => item.kind === 'visual').map((item) => item.mediaId);
            const filteredVisualMediaIds = filteredManifest.items
                .filter((item) => item.kind === 'visual')
                .map((item) => item.mediaId);

            assert.deepEqual(visualMediaIds, [firstMedia.id, thirdMedia.id]);
            assert.deepEqual(filteredVisualMediaIds, [secondMedia.id]);
        } finally {
            await dataSource.destroy();
        }
    });

    it('keeps all visual items on the scroll track layer when a scroll track exists', async () => {
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
            const product = await dataSource.manager.save(new Product({ title: 'Visual layer product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Visual layer episode',
                })
            );
            const visualTrack = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Scroll',
                    type: 'scroll',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            await setDefaultCanvas(dataSource, episode, canvas);
            const firstMedia = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'layer-first.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/layer-first.png',
                })
            );
            const secondMedia = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'layer-second.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/layer-second.png',
                })
            );
            await dataSource.manager.save([
                new CanvasMedia({ canvasId: canvas.id, mediaId: firstMedia.id, index: 0 }),
                new CanvasMedia({ canvasId: canvas.id, mediaId: secondMedia.id, index: 1 }),
            ]);

            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new AnchorRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const manifest = await playerService.getPlayerInfo({ episodeId: episode.id });
            const manifestVisualTrack = manifest.tracks.find((track) => track.id === visualTrack.id);
            const visualLayerIds = manifest.items
                .filter((item) => item.kind === 'visual')
                .map((item) => item.layerId);

            assert.equal(manifestVisualTrack?.kind, 'scroll');
            assert.equal(manifestVisualTrack?.layerId, 0);
            assert.deepEqual(visualLayerIds, [0, 0]);
        } finally {
            await dataSource.destroy();
        }
    });

    it('uses preview visual clip sequence timing without stretching media across cue duration', async () => {
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
            const product = await dataSource.manager.save(new Product({ title: 'No synthetic visual windows product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'No synthetic visual windows episode',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            await setDefaultCanvas(dataSource, episode, canvas);
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

            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new AnchorRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const manifest = await playerService.getPlayerInfo({ episodeId: episode.id });
            const visualWindows = manifest.items
                .filter((item) => item.kind === 'visual')
                .map((item) => ({
                    mediaId: item.mediaId,
                    startTime: item.startTime,
                    endTime: item.endTime,
                }));

            assert.deepEqual(visualWindows, [
                { mediaId: firstMedia.id, startTime: 0, endTime: 1000 },
                { mediaId: secondMedia.id, startTime: 1000, endTime: 2000 },
            ]);
        } finally {
            await dataSource.destroy();
        }
    });

    it('exposes anchors in player manifest without requiring scroll events', async () => {
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
            const product = await dataSource.manager.save(new Product({ title: 'Anchor fallback product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Anchor fallback episode',
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
            await setDefaultCanvas(dataSource, episode, canvas);
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'anchor-fallback.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/anchor-fallback.png',
                })
            );
            await dataSource.manager.save(new CanvasMedia({ canvasId: canvas.id, mediaId: media.id, index: 0 }));
            await dataSource.manager.save([
                new Anchor({
                    trackId: scrollTrack.id,
                    canvasId: canvas.id,
                    time: 1000,
                    index: 0,
                    position: 25,
                }),
                new Anchor({
                    trackId: scrollTrack.id,
                    canvasId: canvas.id,
                    time: 3000,
                    index: 0,
                    position: 75,
                }),
            ]);

            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new AnchorRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const manifest = await playerService.getPlayerInfo({ episodeId: episode.id });

            assert.equal(manifest.totalDuration, 3000);
            assert.deepEqual(
                (manifest as typeof manifest & {
                    anchors?: Array<{
                        trackId: number;
                        canvasId: number;
                        time: number;
                        index: number;
                        position: number;
                    }>;
                }).anchors?.map((anchor) => ({
                    trackId: anchor.trackId,
                    canvasId: anchor.canvasId,
                    time: anchor.time,
                    index: anchor.index,
                    position: anchor.position,
                })),
                [
                    {
                        trackId: scrollTrack.id,
                        canvasId: canvas.id,
                        time: 1000,
                        index: 0,
                        position: 25,
                    },
                    {
                        trackId: scrollTrack.id,
                        canvasId: canvas.id,
                        time: 3000,
                        index: 0,
                        position: 75,
                    },
                ]
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('maps canvas media video controls to manifest visual items', async () => {
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
            const product = await dataSource.manager.save(new Product({ title: 'Visual video controls product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Visual video controls episode',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            await setDefaultCanvas(dataSource, episode, canvas);
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'controlled-video.mp4',
                    mediaType: 'video',
                    mediaUrl: 'https://assets.example.com/controlled-video.mp4',
                    duration: 12000,
                })
            );
            await dataSource.manager.save(
                new CanvasMedia({
                    canvasId: canvas.id,
                    mediaId: media.id,
                    index: 0,
                    startTime: 2000,
                    endTime: 9000,
                    sourceStartTime: 1000,
                    sourceEndTime: 8000,
                    volume: 0.55,
                    isMuted: false,
                })
            );

            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new AnchorRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const manifest = await playerService.getPlayerInfo({ episodeId: episode.id });
            const visualItem = manifest.items.find((item) => item.mediaId === media.id);

            assert.ok(visualItem);
            assert.equal(visualItem.startTime, 2000);
            assert.equal(visualItem.endTime, 9000);
            assert.equal(visualItem.trimStartTime, 1000);
            assert.equal(visualItem.trimEndTime, 8000);
            assert.equal(visualItem.hasTimelineControls, true);
            assert.equal(visualItem.isMuted, false);
            assert.equal(visualItem.volume, 0.55);
        } finally {
            await dataSource.destroy();
        }
    });

    it('maps cue source ranges and strip positions to manifest cues and audio items', async () => {
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
            const product = await dataSource.manager.save(new Product({ title: 'Cue range product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue range episode',
                })
            );
            const audioTrack = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'BGM',
                    type: 'audio',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            await setDefaultCanvas(dataSource, episode, canvas);
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'cue-position.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/cue-position.png',
                })
            );
            const canvasMedia = await dataSource.manager.save(
                new CanvasMedia({ canvasId: canvas.id, mediaId: media.id, index: 0 })
            );
            const audio = await dataSource.manager.save(
                new Audio({
                    episodeId: episode.id,
                    audioType: 'audio',
                    name: 'cue-range.mp3',
                    audioUrl: 'https://assets.example.com/cue-range.mp3',
                    duration: 8000,
                })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    script: '오디오 트림 테스트',
                    trackId: audioTrack.id,
                    audioId: audio.id,
                    startCanvasMediaId: canvasMedia.id,
                    endCanvasMediaId: canvasMedia.id,
                    startTime: 1000,
                    endTime: 5000,
                    audioStartTime: 2000,
                    audioEndTime: 6000,
                    startPosition: 12,
                    endPosition: 64,
                    volume: 0.6,
                })
            );

            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new AnchorRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const manifest = await playerService.getPlayerInfo({ episodeId: episode.id });
            const manifestCue = manifest.cues.find((item) => item.id === cue.id) as
                | (typeof manifest.cues[number] & {
                      startCanvasMediaId?: number;
                      endCanvasMediaId?: number;
                      audioStartTime?: number;
                      audioEndTime?: number;
                      startPosition?: number;
                      endPosition?: number;
                  })
                | undefined;
            const audioItem = manifest.items.find((item) => item.cueId === cue.id);

            assert.deepEqual(
                {
                    startCanvasMediaId: manifestCue?.startCanvasMediaId,
                    endCanvasMediaId: manifestCue?.endCanvasMediaId,
                    audioStartTime: manifestCue?.audioStartTime,
                    audioEndTime: manifestCue?.audioEndTime,
                    startPosition: manifestCue?.startPosition,
                    endPosition: manifestCue?.endPosition,
                },
                {
                    startCanvasMediaId: canvasMedia.id,
                    endCanvasMediaId: canvasMedia.id,
                    audioStartTime: 2000,
                    audioEndTime: 6000,
                    startPosition: 12,
                    endPosition: 64,
                }
            );
            assert.deepEqual(
                {
                    kind: audioItem?.kind,
                    mediaId: audioItem?.mediaId,
                    trimStartTime: audioItem?.trimStartTime,
                    trimEndTime: audioItem?.trimEndTime,
                    volume: audioItem?.volume,
                },
                {
                    kind: 'audio',
                    mediaId: audio.id,
                    trimStartTime: 2000,
                    trimEndTime: 6000,
                    volume: 0.6,
                }
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('does not expose unaccepted records as approved cue playback', async () => {
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
            const product = await dataSource.manager.save(new Product({ title: 'Unaccepted record product' }));
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: '나리',
                    role: 'starring',
                })
            );
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Unaccepted record episode',
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            await setDefaultCanvas(dataSource, episode, canvas);
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Dialogue',
                    type: 'record',
                    characterId: character.id,
                })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    script: '미채택 녹음 테스트',
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 0,
                    endTime: 2000,
                })
            );
            await dataSource.manager.save(
                new RecordEntity({
                    cueId: cue.id,
                    recordUrl: 'https://assets.example.com/unaccepted.wav',
                    duration: 1800,
                    isAccepted: false,
                })
            );

            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new AnchorRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const manifest = await playerService.getPlayerInfo({ episodeId: episode.id });

            assert.equal(manifest.records.length, 1);
            assert.equal(manifest.records[0].isAccepted, false);
            assert.equal(manifest.cues[0].approvedRecordUrl, undefined);
        } finally {
            await dataSource.destroy();
        }
    });

    it('keeps scroll timing separate from preview visual clip timing', async () => {
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
            await setDefaultCanvas(dataSource, episode, canvas);
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
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new AudioRepository(dataSource),
                new AnchorRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource)
            );

            const manifest = await playerService.getPlayerInfo({ episodeId: episode.id });
            const visualByMediaId = new Map(
                manifest.items
                    .filter((item) => item.kind === 'visual')
                    .map((item) => [item.mediaId, item])
            );

            assert.equal(visualByMediaId.get(firstMedia.id)?.startTime, 0);
            assert.equal(visualByMediaId.get(firstMedia.id)?.endTime, 1000);
            assert.equal(visualByMediaId.get(secondMedia.id)?.startTime, 1000);
            assert.equal(visualByMediaId.get(secondMedia.id)?.endTime, 2000);
            assert.deepEqual(
                manifest.scrolls.map((scroll) => ({
                    canvasId: scroll.canvasId,
                    startIndex: scroll.startIndex,
                    endIndex: scroll.endIndex,
                    startTime: scroll.startTime,
                    endTime: scroll.endTime,
                    startPosition: scroll.startPosition,
                    endPosition: scroll.endPosition,
                })),
                [
                    {
                        canvasId: canvas.id,
                        startIndex: 1,
                        endIndex: 1,
                        startTime: 1000,
                        endTime: 2000,
                        startPosition: 10,
                        endPosition: 20,
                    },
                    {
                        canvasId: canvas.id,
                        startIndex: 0,
                        endIndex: 0,
                        startTime: 7000,
                        endTime: 9000,
                        startPosition: 70,
                        endPosition: 90,
                    },
                ]
            );
            assert.equal(manifest.totalDuration, 9000);
        } finally {
            await dataSource.destroy();
        }
    });
});
