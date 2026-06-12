import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSelectedPreviewVisual, getPreviewScrollPosition } from '../previewScrollPosition';

test('getPreviewScrollPosition returns no position when there is no active scroll event', () => {
    assert.equal(getPreviewScrollPosition({ playhead: 12, scrollEvents: [], stripHeightPx: 2400 }), undefined);
    assert.equal(
        getPreviewScrollPosition({
            playhead: 12,
            scrollEvents: [{ start: 20, duration: 4, previewStartPx: 100, previewEndPx: 500 }],
            stripHeightPx: 2400,
        }),
        undefined,
    );
});

test('getPreviewScrollPosition interpolates only inside the active scroll event', () => {
    assert.equal(
        getPreviewScrollPosition({
            playhead: 12,
            scrollEvents: [{ start: 10, duration: 4, previewStartPx: 100, previewEndPx: 500 }],
            stripHeightPx: 2400,
        }),
        300,
    );
});

test('getSelectedPreviewVisual is driven by explicit visual selection only', () => {
    const visualClips = [{ id: 'image-1' }, { id: 'image-2' }];

    assert.deepEqual(getSelectedPreviewVisual(visualClips, 'image-2'), { id: 'image-2' });
    assert.equal(getSelectedPreviewVisual(visualClips, 'audio-1'), undefined);
    assert.equal(getSelectedPreviewVisual(visualClips, ''), undefined);
});
