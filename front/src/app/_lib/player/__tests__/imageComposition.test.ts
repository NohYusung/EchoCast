import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    confirmImageCompositionDraft,
    moveImageCompositionLayer,
    removeImageCompositionLayer,
    syncImageCompositionDraft,
    toCanvasCreateMedias,
    updateImageCompositionLayer,
    type ImageCompositionSource,
} from '../imageComposition';

const sources: ImageCompositionSource[] = [
    {
        clipId: 'canvas-1',
        canvasId: 1,
        mediaId: 1,
        mediaType: 'image',
        label: '이미지 01',
        mediaUrl: 'https://assets.example.com/1.png',
        order: 0,
    },
    {
        clipId: 'canvas-2',
        canvasId: 2,
        mediaId: 2,
        mediaType: 'image',
        label: '이미지 02',
        mediaUrl: 'https://assets.example.com/2.png',
        order: 1,
    },
];

test('syncImageCompositionDraft creates image layers from visual sources', () => {
    const draft = syncImageCompositionDraft(sources);

    assert.equal(draft.layers.length, 2);
    assert.equal(draft.selectedLayerId, 'image-layer-canvas-1');
    assert.equal(draft.layers[0].mediaUrl, 'https://assets.example.com/1.png');
});

test('updateImageCompositionLayer preserves bounds and marks the draft editable', () => {
    const draft = confirmImageCompositionDraft(syncImageCompositionDraft(sources), '2026-06-11T00:00:00.000Z');
    const updated = updateImageCompositionLayer(draft, draft.selectedLayerId, {
        x: 120,
        y: -20,
        scale: 4,
        opacity: 0,
    });

    assert.equal(updated.layers[0].x, 100);
    assert.equal(updated.layers[0].y, 0);
    assert.equal(updated.layers[0].scale, 1.8);
    assert.equal(updated.layers[0].opacity, 0.2);
    assert.equal(updated.status, 'editing');
});

test('moveImageCompositionLayer changes layer order for composition output', () => {
    const draft = syncImageCompositionDraft(sources);
    const moved = moveImageCompositionLayer(draft, 'image-layer-canvas-1', 'up');

    assert.equal(moved.layers[0].clipId, 'canvas-2');
    assert.equal(moved.layers[1].clipId, 'canvas-1');
});

test('removeImageCompositionLayer removes a layer and selects the next available layer', () => {
    const draft = syncImageCompositionDraft(sources);
    const removed = removeImageCompositionLayer(draft, 'image-layer-canvas-1');

    assert.deepEqual(
        removed.layers.map((layer) => ({ clipId: layer.clipId, zIndex: layer.zIndex })),
        [{ clipId: 'canvas-2', zIndex: 0 }],
    );
    assert.equal(removed.selectedLayerId, 'image-layer-canvas-2');
    assert.equal(removed.status, 'editing');
});

test('syncImageCompositionDraft follows visual source reorder for canvas media index', () => {
    const draft = updateImageCompositionLayer(syncImageCompositionDraft(sources), 'image-layer-canvas-1', { x: 42 });
    const confirmed = confirmImageCompositionDraft(draft, '2026-06-11T00:00:00.000Z');
    const reordered = syncImageCompositionDraft(
        [
            { ...sources[1], order: 0 },
            { ...sources[0], order: 1 },
        ],
        confirmed,
    );

    assert.equal(reordered.status, 'editing');
    assert.equal(reordered.confirmedAt, undefined);
    assert.deepEqual(
        reordered.layers.map((layer) => layer.clipId),
        ['canvas-2', 'canvas-1'],
    );
    assert.equal(reordered.layers.find((layer) => layer.clipId === 'canvas-1')?.x, 42);
    assert.deepEqual(
        toCanvasCreateMedias(reordered).map((media) => ({ mediaId: media.mediaId, mediaName: media.mediaName, index: media.index })),
        [
            { mediaId: 2, mediaName: '이미지 02', index: 0 },
            { mediaId: 1, mediaName: '이미지 01', index: 1 },
        ],
    );
});

test('toCanvasCreateMedias maps visible image layers to canvas media payload', () => {
    const draft = syncImageCompositionDraft(sources);
    const arranged = updateImageCompositionLayer(draft, 'image-layer-canvas-1', {
        x: 42,
        y: 58,
        scale: 1.25,
        opacity: 0.8,
    });
    const hidden = updateImageCompositionLayer(arranged, 'image-layer-canvas-2', { isVisible: false });

    assert.deepEqual(toCanvasCreateMedias(hidden), [
        {
            mediaId: 1,
            mediaName: '이미지 01',
            mediaType: 'image',
            mediaUrl: 'https://assets.example.com/1.png',
            index: 0,
            x: 42,
            y: 58,
            scale: 1.25,
            opacity: 0.8,
        },
    ]);
});

test('toCanvasCreateMedias can target one existing canvas and return an empty update payload', () => {
    const canvasSources: ImageCompositionSource[] = [
        { ...sources[0], clipId: 'canvas-10-media-1', canvasId: 10, order: 0 },
        { ...sources[1], clipId: 'canvas-10-media-2', canvasId: 10, order: 1 },
        {
            clipId: 'canvas-11',
            canvasId: 11,
            mediaId: 3,
            mediaType: 'image',
            label: '이미지 03',
            mediaUrl: 'https://assets.example.com/3.png',
            order: 2,
        },
    ];
    const draft = syncImageCompositionDraft(canvasSources);
    const removedOne = removeImageCompositionLayer(draft, 'image-layer-canvas-10-media-1');
    const removedBoth = removeImageCompositionLayer(removedOne, 'image-layer-canvas-10-media-2');

    assert.deepEqual(
        toCanvasCreateMedias(removedOne, { canvasId: 10 }).map((media) => ({ mediaId: media.mediaId, index: media.index })),
        [{ mediaId: 2, index: 0 }],
    );
    assert.deepEqual(toCanvasCreateMedias(removedBoth, { canvasId: 10 }), []);
    assert.deepEqual(
        toCanvasCreateMedias(removedBoth, { canvasId: 11 }).map((media) => ({ mediaId: media.mediaId, index: media.index })),
        [{ mediaId: 3, index: 0 }],
    );
});

test('toCanvasCreateMedias keeps video layers in the canvas media payload', () => {
    const videoSources: ImageCompositionSource[] = [
        {
            clipId: 'media-9',
            mediaId: 9,
            mediaType: 'video',
            label: '영상 01',
            mediaUrl: 'https://assets.example.com/clip.mp4',
            order: 0,
        },
    ];
    const draft = syncImageCompositionDraft(videoSources);

    assert.deepEqual(toCanvasCreateMedias(draft), [
        {
            mediaId: 9,
            mediaName: '영상 01',
            mediaType: 'video',
            mediaUrl: 'https://assets.example.com/clip.mp4',
            index: 0,
            x: 50,
            y: 50,
            scale: 1,
            opacity: 1,
        },
    ]);
});
