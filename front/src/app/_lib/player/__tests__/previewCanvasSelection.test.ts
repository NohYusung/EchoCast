import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    filterPreviewCanvasItems,
    getPreviewCanvasOptions,
    resolvePreviewCanvasId,
} from '../previewCanvasSelection';

test('resolvePreviewCanvasId keeps the current canvas when it still exists', () => {
    assert.equal(resolvePreviewCanvasId([{ id: 1 }, { id: 2 }], 2), 2);
});

test('resolvePreviewCanvasId falls back to the first canvas when the current canvas is missing', () => {
    assert.equal(resolvePreviewCanvasId([{ id: 3 }, { id: 4 }], 99), 3);
    assert.equal(resolvePreviewCanvasId([], 99), null);
});

test('filterPreviewCanvasItems returns only items that belong to the selected canvas', () => {
    assert.deepEqual(
        filterPreviewCanvasItems(
            [
                { id: 'canvas-1-media-10', canvasId: 1 },
                { id: 'canvas-2-media-20', canvasId: 2 },
                { id: 'pending-media-30' },
            ],
            2,
        ),
        [{ id: 'canvas-2-media-20', canvasId: 2 }],
    );
});

test('getPreviewCanvasOptions exposes canvas labels and media counts for the selector', () => {
    assert.deepEqual(
        getPreviewCanvasOptions([
            { id: 10, medias: [{ mediaId: 100 }, { mediaId: 101 }] },
            { id: 11, mediaId: 102 },
            { id: 12 },
        ]),
        [
            { id: 10, label: '캔버스 1', mediaCount: 2 },
            { id: 11, label: '캔버스 2', mediaCount: 1 },
            { id: 12, label: '캔버스 3', mediaCount: 0 },
        ],
    );
});
