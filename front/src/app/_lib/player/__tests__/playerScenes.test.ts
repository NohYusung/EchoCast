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
            mediaId: scene.mediaId,
            startTime: scene.startTime,
            endTime: scene.endTime,
        })),
        [
            { mediaId: 'media-2', startTime: 0, endTime: 4000 },
            { mediaId: 'media-1', startTime: 0, endTime: 4000 },
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
                height: 420,
                background: '#111827',
            },
        ]),
        true,
    );
});
