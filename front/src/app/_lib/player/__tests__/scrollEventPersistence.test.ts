import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    getScrollEventApiId,
    toClickedScrollAnchorMutationRequest,
    toDraggedScrollAnchorMutationRequest,
    toSingleScrollAnchorMutationRequest,
    toScrollAnchorMutationRequests,
    toScrollEventMutationRequest,
} from '../scrollEventPersistence';

test('getScrollEventApiId uses the explicit scroll id before parsing the local id', () => {
    assert.equal(getScrollEventApiId({ id: 'local-scroll-1', scrollId: 42 }), 42);
    assert.equal(getScrollEventApiId({ id: 'scroll-7' }), 7);
    assert.equal(getScrollEventApiId({ id: 'local-scroll-1' }), undefined);
});

test('toScrollEventMutationRequest maps persisted scroll anchor ids', () => {
    assert.deepEqual(
        toScrollEventMutationRequest({
            id: 'scroll-7',
            track: '3',
            startAnchorId: 12,
            endAnchorId: 13,
            start: 1.25,
            duration: 3.5,
            startPosition: 12.4,
            endPosition: 84.6,
        }),
        {
            startAnchorId: 12,
            endAnchorId: 13,
        },
    );
});

test('toScrollAnchorMutationRequests keeps API scroll positions in percent units', () => {
    assert.deepEqual(
        toScrollAnchorMutationRequests({
            id: 'scroll-7',
            track: '3',
            canvasId: 11,
            startIndex: 2,
            endIndex: 3,
            start: 1.25,
            duration: 3.5,
            startPosition: 12.4,
            endPosition: 84.6,
        }),
        {
            start: {
                canvasId: 11,
                time: 1250,
                position: 12,
                index: 2,
            },
            end: {
                canvasId: 11,
                time: 4750,
                position: 85,
                index: 3,
            },
        },
    );
});

test('toSingleScrollAnchorMutationRequest maps the preview anchor to the anchor API contract', () => {
    assert.deepEqual(
        toSingleScrollAnchorMutationRequest({
            canvasId: 11,
            index: 2,
            playhead: 1.25,
            position: 37.6,
        }),
        {
            canvasId: 11,
            index: 2,
            time: 1250,
            position: 38,
        },
    );
});

test('toSingleScrollAnchorMutationRequest rejects incomplete preview anchor data', () => {
    assert.equal(
        toSingleScrollAnchorMutationRequest({
            canvasId: undefined,
            index: 2,
            playhead: 1.25,
            position: 37.6,
        }),
        undefined,
    );
    assert.equal(
        toSingleScrollAnchorMutationRequest({
            canvasId: 11,
            index: 2,
            playhead: 1.25,
            position: 120,
        }),
        undefined,
    );
});

test('toClickedScrollAnchorMutationRequest maps a clicked strip pixel to a canvas-local anchor', () => {
    assert.deepEqual(
        toClickedScrollAnchorMutationRequest({
            playhead: 2.4,
            stripHeightPx: 600,
            stripPositionPx: 250,
            visualSegments: [
                { id: 'first', canvasId: 10, index: 0, top: 0, height: 200 },
                { id: 'second', canvasId: 11, index: 3, top: 200, height: 200 },
            ],
        }),
        {
            canvasId: 11,
            index: 3,
            time: 2400,
            position: 25,
        },
    );
});

test('toClickedScrollAnchorMutationRequest rejects clicks that cannot resolve a numeric canvas', () => {
    assert.equal(
        toClickedScrollAnchorMutationRequest({
            playhead: 2.4,
            stripHeightPx: 600,
            stripPositionPx: 250,
            visualSegments: [{ id: 'second', canvasId: 'canvas-11', index: 3, top: 200, height: 200 }],
        }),
        undefined,
    );
});

test('toDraggedScrollAnchorMutationRequest preserves anchor time while remapping strip position', () => {
    assert.deepEqual(
        toDraggedScrollAnchorMutationRequest({
            anchor: {
                canvasId: 10,
                index: 0,
                time: 5100,
                position: 80,
            },
            stripHeightPx: 600,
            stripPositionPx: 250,
            visualSegments: [
                { id: 'first', canvasId: 10, index: 0, top: 0, height: 200 },
                { id: 'second', canvasId: 11, index: 3, top: 200, height: 200 },
            ],
        }),
        {
            canvasId: 11,
            index: 3,
            time: 5100,
            position: 25,
        },
    );
});

test('toDraggedScrollAnchorMutationRequest rejects anchors dragged outside numeric canvas data', () => {
    assert.equal(
        toDraggedScrollAnchorMutationRequest({
            anchor: {
                canvasId: 10,
                index: 0,
                time: 5100,
                position: 80,
            },
            stripHeightPx: 600,
            stripPositionPx: 250,
            visualSegments: [{ id: 'second', canvasId: 'canvas-11', index: 3, top: 200, height: 200 }],
        }),
        undefined,
    );
});
