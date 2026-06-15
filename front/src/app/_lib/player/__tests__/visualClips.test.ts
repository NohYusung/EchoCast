import assert from 'node:assert/strict';
import { test } from 'node:test';
import { removeVisualClipFromCanvas, type VisualClip } from '../visualClips';

function createClip(id: string, canvasId: number, start: number, duration: number): VisualClip {
    return {
        id,
        canvasId,
        mediaId: Number(id.replace(/\D/g, '')) || 1,
        kind: 'cut',
        start,
        duration,
        label: id,
        description: id,
        background: '#000',
        mediaType: 'image',
        mediaUrl: `/media/${id}.png`,
    };
}

test('removeVisualClipFromCanvas removes one canvas layer and reflows only that canvas', () => {
    const clips = [
        createClip('clip-1', 10, 0, 1),
        createClip('clip-2', 10, 1, 2),
        createClip('clip-3', 10, 3, 1),
        createClip('clip-4', 11, 20, 5),
    ];

    const nextClips = removeVisualClipFromCanvas(clips, 'clip-2', 10);

    assert.deepEqual(
        nextClips.map((clip) => ({ id: clip.id, canvasId: clip.canvasId, start: clip.start, duration: clip.duration })),
        [
            { id: 'clip-1', canvasId: 10, start: 0, duration: 1 },
            { id: 'clip-3', canvasId: 10, start: 1, duration: 1 },
            { id: 'clip-4', canvasId: 11, start: 20, duration: 5 },
        ],
    );
    assert.deepEqual(
        clips.map((clip) => clip.id),
        ['clip-1', 'clip-2', 'clip-3', 'clip-4'],
    );
});

test('removeVisualClipFromCanvas ignores clips outside the selected canvas', () => {
    const clips = [createClip('clip-1', 10, 0, 1), createClip('clip-2', 11, 0, 1)];

    assert.deepEqual(removeVisualClipFromCanvas(clips, 'clip-2', 10), clips);
});
