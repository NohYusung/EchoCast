import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPreviewScrollPosition } from '../previewScrollPosition';
import { toPreviewPlaybackAnchors } from '../previewPlaybackAnchors';

test('toPreviewPlaybackAnchors converts persisted millisecond anchor time to preview seconds', () => {
    const anchors = toPreviewPlaybackAnchors([
        { time: 10000, canvasId: 11, index: 0, position: 50 },
        { time: 20000, canvasId: 11, index: 1, position: 40 },
    ]);

    assert.deepEqual(anchors, [
        { time: 10, canvasId: 11, index: 0, position: 50 },
        { time: 20, canvasId: 11, index: 1, position: 40 },
    ]);

    assert.equal(
        getPreviewScrollPosition({
            playhead: 18,
            scrollEvents: [],
            anchors,
            stripHeightPx: 800,
            visualSegments: [
                { id: 'clip-1', canvasId: 11, index: 0, top: 0, height: 300 },
                { id: 'clip-2', canvasId: 11, index: 1, top: 300, height: 500 },
            ],
        }),
        150,
    );
});
