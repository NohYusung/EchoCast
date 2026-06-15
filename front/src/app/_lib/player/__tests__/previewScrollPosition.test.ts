import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    getPreviewScrollAnchor,
    getPreviewScrollOffset,
    getPreviewScrollOffsetForAnchor,
    getPreviewScrollPixel,
    getSelectedPreviewVisual,
    getPreviewScrollPosition,
    resolvePreviewScrollOffset,
} from '../previewScrollPosition';

test('getPreviewScrollPosition returns no position when there is no active scroll event', () => {
    assert.equal(getPreviewScrollPosition({ playhead: 12, scrollEvents: [], stripHeightPx: 2400 }), undefined);
    assert.equal(
        getPreviewScrollPosition({
            playhead: 12,
            scrollEvents: [{ start: 20, duration: 4, startPosition: 10, endPosition: 30 }],
            stripHeightPx: 2400,
        }),
        undefined,
    );
});

test('getPreviewScrollPosition falls back to the latest anchor when no scroll event is active', () => {
    assert.equal(
        getPreviewScrollPosition({
            playhead: 18,
            scrollEvents: [],
            anchors: [
                { time: 10, canvasId: 11, index: 0, position: 50 },
                { time: 20, canvasId: 11, index: 1, position: 40 },
            ],
            stripHeightPx: 800,
            visualSegments: [
                { id: 'clip-1', canvasId: 11, index: 0, top: 0, height: 300 },
                { id: 'clip-2', canvasId: 11, index: 1, top: 300, height: 500 },
            ],
        }),
        150,
    );
});

test('getPreviewScrollPosition uses whole-strip percent fallback when visual segments are not measured', () => {
    assert.equal(
        getPreviewScrollPosition({
            playhead: 12,
            scrollEvents: [{ start: 10, duration: 4, startPosition: 10, endPosition: 30 }],
            stripHeightPx: 2000,
        }),
        400,
    );
});

test('getPreviewScrollAnchor maps strip pixels to media index and local percent position', () => {
    assert.deepEqual(
        getPreviewScrollAnchor({
            stripPositionPx: 450,
            stripHeightPx: 800,
            visualSegments: [
                { id: 'clip-1', canvasId: 11, index: 0, top: 0, height: 300 },
                { id: 'clip-2', canvasId: 11, index: 1, top: 300, height: 500 },
            ],
        }),
        {
            visualId: 'clip-2',
            canvasId: 11,
            index: 1,
            position: 30,
        },
    );
});

test('getPreviewScrollPixel maps media index and local percent position back to strip pixels', () => {
    assert.equal(
        getPreviewScrollPixel({
            canvasId: 11,
            index: 1,
            position: 30,
            stripHeightPx: 800,
            visualSegments: [
                { id: 'clip-1', canvasId: 11, index: 0, top: 0, height: 300 },
                { id: 'clip-2', canvasId: 11, index: 1, top: 300, height: 500 },
            ],
        }),
        450,
    );
});

test('getPreviewScrollPosition interpolates between media-local anchors', () => {
    assert.equal(
        getPreviewScrollPosition({
            playhead: 12,
            scrollEvents: [
                {
                    start: 10,
                    duration: 4,
                    canvasId: 11,
                    startIndex: 0,
                    endIndex: 1,
                    startPosition: 83.33,
                    endPosition: 50,
                },
            ],
            stripHeightPx: 800,
            visualSegments: [
                { id: 'clip-1', canvasId: 11, index: 0, top: 0, height: 300 },
                { id: 'clip-2', canvasId: 11, index: 1, top: 300, height: 500 },
            ],
        }),
        400,
    );
});

test('getPreviewScrollPosition holds the last event position between scroll events', () => {
    assert.equal(
        getPreviewScrollPosition({
            playhead: 15,
            scrollEvents: [
                {
                    start: 10,
                    duration: 2,
                    canvasId: 11,
                    startIndex: 0,
                    endIndex: 1,
                    startPosition: 0,
                    endPosition: 50,
                },
                {
                    start: 20,
                    duration: 2,
                    canvasId: 11,
                    startIndex: 1,
                    endIndex: 1,
                    startPosition: 50,
                    endPosition: 100,
                },
            ],
            stripHeightPx: 800,
            visualSegments: [
                { id: 'clip-1', canvasId: 11, index: 0, top: 0, height: 300 },
                { id: 'clip-2', canvasId: 11, index: 1, top: 300, height: 500 },
            ],
        }),
        550,
    );
});

test('getPreviewScrollPosition keeps position during fixed pause events', () => {
    assert.equal(
        getPreviewScrollPosition({
            playhead: 13,
            scrollEvents: [
                {
                    start: 12,
                    duration: 4,
                    canvasId: 11,
                    startIndex: 1,
                    endIndex: 1,
                    startPosition: 40,
                    endPosition: 40,
                },
            ],
            stripHeightPx: 800,
            visualSegments: [
                { id: 'clip-1', canvasId: 11, index: 0, top: 0, height: 300 },
                { id: 'clip-2', canvasId: 11, index: 1, top: 300, height: 500 },
            ],
        }),
        500,
    );
});

test('getPreviewScrollOffset centers the active media-local anchor in the viewport', () => {
    assert.equal(
        getPreviewScrollOffset({
            playhead: 12,
            scrollEvents: [
                {
                    start: 10,
                    duration: 4,
                    canvasId: 11,
                    startIndex: 0,
                    endIndex: 1,
                    startPosition: 50,
                    endPosition: 50,
                },
            ],
            stripHeightPx: 800,
            viewportHeightPx: 200,
            visualSegments: [
                { id: 'clip-1', canvasId: 11, index: 0, top: 0, height: 300 },
                { id: 'clip-2', canvasId: 11, index: 1, top: 300, height: 500 },
            ],
        }),
        250,
    );
});

test('getPreviewScrollOffsetForAnchor centers a selected anchor even when no scroll event is active', () => {
    assert.equal(
        getPreviewScrollOffsetForAnchor({
            canvasId: 11,
            index: 1,
            position: 30,
            stripHeightPx: 800,
            viewportHeightPx: 200,
            visualSegments: [
                { id: 'clip-1', canvasId: 11, index: 0, top: 0, height: 300 },
                { id: 'clip-2', canvasId: 11, index: 1, top: 300, height: 500 },
            ],
        }),
        350,
    );
});

test('getPreviewScrollOffset returns no offset outside stored scroll events', () => {
    assert.equal(
        getPreviewScrollOffset({
            playhead: 4,
            scrollEvents: [{ start: 10, duration: 4, startPosition: 0, endPosition: 100 }],
            stripHeightPx: 800,
            viewportHeightPx: 200,
        }),
        undefined,
    );
});

test('resolvePreviewScrollOffset uses playback offset while preview is playing', () => {
    assert.equal(
        resolvePreviewScrollOffset({
            isPlaying: true,
            playbackOffsetPx: 240,
            selectedAnchorOffsetPx: 80,
        }),
        240,
    );
});

test('resolvePreviewScrollOffset uses selected anchor offset only while preview is not playing', () => {
    assert.equal(
        resolvePreviewScrollOffset({
            isPlaying: false,
            playbackOffsetPx: 240,
            selectedAnchorOffsetPx: 80,
        }),
        80,
    );
});

test('getSelectedPreviewVisual is driven by explicit visual selection only', () => {
    const visualClips = [{ id: 'image-1' }, { id: 'image-2' }];

    assert.deepEqual(getSelectedPreviewVisual(visualClips, 'image-2'), { id: 'image-2' });
    assert.equal(getSelectedPreviewVisual(visualClips, 'audio-1'), undefined);
    assert.equal(getSelectedPreviewVisual(visualClips, ''), undefined);
});
