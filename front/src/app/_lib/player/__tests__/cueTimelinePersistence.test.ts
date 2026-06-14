import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    resolveCueTimelineTrackId,
    toClickedCuePositionRequest,
    toCuePositionUpdateRequest,
    toCueStripMarker,
} from '../cueTimelinePersistence';

test('toClickedCuePositionRequest maps a clicked strip pixel to canvas media cue positions', () => {
    assert.deepEqual(
        toClickedCuePositionRequest({
            stripHeightPx: 600,
            stripPositionPx: 250,
            visualClips: [
                { id: 'first', canvasId: 10, index: 0, canvasMediaId: 101 },
                { id: 'second', canvasId: 10, index: 1, canvasMediaId: 102 },
            ],
            visualSegments: [
                { id: 'first', canvasId: 10, index: 0, top: 0, height: 200 },
                { id: 'second', canvasId: 10, index: 1, top: 200, height: 200 },
            ],
        }),
        {
            startCanvasMediaId: 102,
            endCanvasMediaId: 102,
            startPosition: 25,
            endPosition: 25,
        },
    );
});

test('toClickedCuePositionRequest rejects clicks before canvas media ids are available', () => {
    assert.equal(
        toClickedCuePositionRequest({
            stripHeightPx: 600,
            stripPositionPx: 250,
            visualClips: [{ id: 'second', canvasId: 10, index: 1 }],
            visualSegments: [{ id: 'second', canvasId: 10, index: 1, top: 200, height: 200 }],
        }),
        undefined,
    );
});

test('toCuePositionUpdateRequest keeps cue start and end positions on their own canvas media', () => {
    assert.deepEqual(
        toCuePositionUpdateRequest({
            stripHeightPx: 600,
            startStripPositionPx: 150,
            endStripPositionPx: 360,
            visualClips: [
                { id: 'first', canvasId: 10, index: 0, canvasMediaId: 101 },
                { id: 'second', canvasId: 10, index: 1, canvasMediaId: 102 },
            ],
            visualSegments: [
                { id: 'first', canvasId: 10, index: 0, top: 0, height: 200 },
                { id: 'second', canvasId: 10, index: 1, top: 200, height: 200 },
            ],
        }),
        {
            startCanvasMediaId: 101,
            endCanvasMediaId: 102,
            startPosition: 75,
            endPosition: 80,
        },
    );
});

test('resolveCueTimelineTrackId prefers the cue owner track over its parent list track', () => {
    assert.equal(resolveCueTimelineTrackId({ parentTrackId: 12, cueTrackId: 11 }), '11');
    assert.equal(resolveCueTimelineTrackId({ parentTrackId: 12 }), '12');
});

test('toCueStripMarker maps persisted cue media positions back to strip pixels', () => {
    assert.deepEqual(
        toCueStripMarker({
            cue: {
                startCanvasMediaId: 102,
                endCanvasMediaId: 102,
                startPosition: 25,
                endPosition: 80,
            },
            stripHeightPx: 600,
            visualClips: [
                { id: 'first', canvasId: 10, index: 0, canvasMediaId: 101 },
                { id: 'second', canvasId: 10, index: 1, canvasMediaId: 102 },
            ],
            visualSegments: [
                { id: 'first', canvasId: 10, index: 0, top: 0, height: 200 },
                { id: 'second', canvasId: 10, index: 1, top: 200, height: 200 },
            ],
        }),
        {
            top: 250,
            endTop: 360,
        },
    );
});

test('toCueStripMarker places unassigned cues on the first visual clip', () => {
    assert.deepEqual(
        toCueStripMarker({
            cue: {
                startPosition: 25,
                endPosition: 80,
            },
            stripHeightPx: 600,
            visualClips: [
                { id: 'first', canvasId: 10, index: 0, canvasMediaId: 101 },
                { id: 'second', canvasId: 10, index: 1, canvasMediaId: 102 },
            ],
            visualSegments: [
                { id: 'first', canvasId: 10, index: 0, top: 0, height: 200 },
                { id: 'second', canvasId: 10, index: 1, top: 200, height: 200 },
            ],
        }),
        {
            top: 50,
            endTop: 160,
        },
    );
});

test('toCueStripMarker rejects cues without a matching canvas media clip', () => {
    assert.equal(
        toCueStripMarker({
            cue: {
                startCanvasMediaId: 999,
                endCanvasMediaId: 999,
                startPosition: 25,
                endPosition: 80,
            },
            stripHeightPx: 600,
            visualClips: [{ id: 'second', canvasId: 10, index: 1, canvasMediaId: 102 }],
            visualSegments: [{ id: 'second', canvasId: 10, index: 1, top: 200, height: 200 }],
        }),
        undefined,
    );
});
