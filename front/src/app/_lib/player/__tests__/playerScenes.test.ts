import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPlayerScenes, shouldDriveStripScrollFromScenes } from '../playerScenes';
import type { PlayerManifest } from '../playerManifest.types';

test('buildPlayerScenes preserves canvas visuals that share the same timeline window', () => {
    const manifest: PlayerManifest = {
        episodeId: '1',
        durationMs: 4000,
        tracks: [
            {
                id: 'visual-1',
                name: 'Visual',
                kind: 'visual',
                layerId: 0,
                isMuted: false,
            },
        ],
        items: [
            {
                id: 'visual-20',
                trackId: 'visual-1',
                kind: 'visual',
                startTime: 0,
                endTime: 4000,
                canvasId: 'canvas-1',
                index: 1,
                mediaId: 'media-2',
                layerId: 0,
                volume: 1,
            },
            {
                id: 'visual-10',
                trackId: 'visual-1',
                kind: 'visual',
                startTime: 0,
                endTime: 4000,
                canvasId: 'canvas-1',
                index: 0,
                mediaId: 'media-1',
                layerId: 1,
                volume: 1,
            },
        ],
        cues: [],
        media: [
            {
                id: 'media-1',
                kind: 'image',
                url: '/media/one.png',
            },
            {
                id: 'media-2',
                kind: 'image',
                url: '/media/two.png',
            },
        ],
        records: [],
        tts: [],
    };

    const scenes = buildPlayerScenes(manifest);

    assert.deepEqual(
        scenes.map((scene) => ({
            canvasId: scene.canvasId,
            index: scene.index,
            mediaId: scene.mediaId,
            startTime: scene.startTime,
            endTime: scene.endTime,
        })),
        [
            { canvasId: 'canvas-1', index: 1, mediaId: 'media-2', startTime: 0, endTime: 4000 },
            { canvasId: 'canvas-1', index: 0, mediaId: 'media-1', startTime: 0, endTime: 4000 },
        ],
    );
    assert.equal(shouldDriveStripScrollFromScenes(scenes), false);
});

test('buildPlayerScenes does not reserve duration-based height for image media', () => {
    const manifest: PlayerManifest = {
        episodeId: '1',
        durationMs: 33000,
        tracks: [
            {
                id: 'visual-1',
                name: 'Visual',
                kind: 'visual',
                layerId: 0,
                isMuted: false,
            },
        ],
        items: [
            {
                id: 'visual-long',
                trackId: 'visual-1',
                kind: 'visual',
                startTime: 0,
                endTime: 33000,
                mediaId: 'media-long',
                layerId: 0,
                volume: 1,
            },
        ],
        cues: [],
        media: [
            {
                id: 'media-long',
                kind: 'image',
                url: '/media/long.png',
            },
        ],
        records: [],
        tts: [],
    };

    const [scene] = buildPlayerScenes(manifest);

    assert.equal(scene.kind, 'image');
    assert.equal(scene.height, 0);
});

test('buildPlayerScenes carries video playback controls from manifest items', () => {
    const manifest: PlayerManifest = {
        episodeId: '1',
        durationMs: 12000,
        tracks: [
            {
                id: 'visual-1',
                name: 'Visual',
                kind: 'visual',
                layerId: 0,
                isMuted: false,
            },
        ],
        items: [
            {
                id: 'visual-video',
                trackId: 'visual-1',
                kind: 'visual',
                startTime: 2000,
                endTime: 9000,
                mediaId: 'video-1',
                layerId: 0,
                trimStartTime: 1000,
                trimEndTime: 8000,
                volume: 0.55,
                isMuted: true,
                hasTimelineControls: true,
            },
        ],
        cues: [],
        media: [
            {
                id: 'video-1',
                kind: 'video',
                url: '/media/video.mp4',
                durationMs: 12000,
            },
        ],
        records: [],
        tts: [],
    };

    const [scene] = buildPlayerScenes(manifest);

    assert.equal(scene.kind, 'video');
    assert.equal(scene.mediaDuration, 12000);
    assert.equal(scene.trimStartTime, 1000);
    assert.equal(scene.trimEndTime, 8000);
    assert.equal(scene.volume, 0.55);
    assert.equal(scene.isMuted, true);
    assert.equal(scene.hasTimelineControls, true);
});

test('buildPlayerScenes uses preview canvas visual clips before legacy visual items', () => {
    const manifest = {
        episodeId: '1',
        durationMs: 12000,
        tracks: [
            {
                id: 'visual-1',
                name: 'Visual',
                kind: 'visual',
                layerId: 0,
                isMuted: false,
            },
        ],
        items: [
            {
                id: 'legacy-visual',
                trackId: 'visual-1',
                kind: 'visual',
                startTime: 7000,
                endTime: 8000,
                mediaId: 'legacy-media',
                layerId: 0,
                volume: 1,
            },
        ],
        canvases: [
            {
                id: 11,
                episodeId: 1,
                medias: [
                    {
                        canvasMediaId: 501,
                        mediaId: 101,
                        mediaName: 'one.png',
                        mediaType: 'image',
                        mediaUrl: '/media/one.png',
                        index: 0,
                    },
                    {
                        canvasMediaId: 502,
                        mediaId: 102,
                        mediaName: 'clip.mp4',
                        mediaType: 'video',
                        mediaUrl: '/media/clip.mp4',
                        duration: 12000,
                        index: 1,
                        startTime: 2000,
                        endTime: 9000,
                        sourceStartTime: 1000,
                        sourceEndTime: 8000,
                        volume: 0.4,
                        isMuted: true,
                    },
                ],
            },
        ],
        cues: [],
        media: [
            {
                id: 'legacy-media',
                kind: 'image',
                url: '/media/legacy.png',
            },
        ],
        records: [],
        tts: [],
    } as PlayerManifest;

    const scenes = buildPlayerScenes(manifest);

    assert.deepEqual(
        scenes.map((scene) => ({
            id: scene.id,
            canvasId: scene.canvasId,
            index: scene.index,
            kind: scene.kind,
            mediaId: scene.mediaId,
            mediaUrl: scene.mediaUrl,
            startTime: scene.startTime,
            endTime: scene.endTime,
            trimStartTime: scene.trimStartTime,
            trimEndTime: scene.trimEndTime,
            mediaDuration: scene.mediaDuration,
            hasTimelineControls: scene.hasTimelineControls,
            isMuted: scene.isMuted,
            volume: scene.volume,
        })),
        [
            {
                id: 'canvas-11-media-101',
                canvasId: 11,
                index: 0,
                kind: 'image',
                mediaId: '101',
                mediaUrl: '/media/one.png',
                startTime: 0,
                endTime: 1000,
                trimStartTime: undefined,
                trimEndTime: undefined,
                mediaDuration: undefined,
                hasTimelineControls: false,
                isMuted: undefined,
                volume: undefined,
            },
            {
                id: 'canvas-11-media-102',
                canvasId: 11,
                index: 1,
                kind: 'video',
                mediaId: '102',
                mediaUrl: '/media/clip.mp4',
                startTime: 2000,
                endTime: 9000,
                trimStartTime: 1000,
                trimEndTime: 8000,
                mediaDuration: 12000,
                hasTimelineControls: true,
                isMuted: true,
                volume: 0.4,
            },
        ],
    );
});

test('shouldDriveStripScrollFromScenes enables playback scroll only when visual timing is distinct', () => {
    assert.equal(
        shouldDriveStripScrollFromScenes([
            {
                id: 'visual-1',
                kind: 'image',
                label: 'CUT 01',
                startTime: 0,
                endTime: 2000,
                mediaId: 'media-1',
                mediaUrl: '/media/one.png',
                volume: 1,
                height: 420,
                background: '#111827',
            },
            {
                id: 'visual-2',
                kind: 'image',
                label: 'CUT 02',
                startTime: 2000,
                endTime: 4000,
                mediaId: 'media-2',
                mediaUrl: '/media/two.png',
                volume: 1,
                height: 420,
                background: '#111827',
            },
        ]),
        true,
    );
});
