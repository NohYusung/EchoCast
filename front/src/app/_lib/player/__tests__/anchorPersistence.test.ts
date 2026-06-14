import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    getAnchorDeleteUrl,
    getAnchorEventDeleteUrl,
    resolveAnchorPlacementTrackId,
    shouldCreateAnchorScrollTrack,
    toAnchorMutationTarget,
} from '../anchorPersistence';

test('toAnchorMutationTarget maps track and anchor ids to the anchor API target', () => {
    assert.deepEqual(
        toAnchorMutationTarget({
            trackId: '7',
            anchorId: 13,
        }),
        {
            trackId: '7',
            anchorId: 13,
        },
    );
});

test('toAnchorMutationTarget rejects missing or invalid ids', () => {
    assert.equal(
        toAnchorMutationTarget({
            trackId: '',
            anchorId: 13,
        }),
        null,
    );
    assert.equal(
        toAnchorMutationTarget({
            trackId: '7',
            anchorId: 0,
        }),
        null,
    );
});

test('getAnchorDeleteUrl and getAnchorEventDeleteUrl build separate delete endpoints', () => {
    const target = { trackId: '7', anchorId: 13 };

    assert.equal(getAnchorDeleteUrl('http://127.0.0.1:4100/', target), 'http://127.0.0.1:4100/tracks/7/anchors/13');
    assert.equal(getAnchorEventDeleteUrl('http://127.0.0.1:4100/', target), 'http://127.0.0.1:4100/tracks/7/anchors/13/event');
});

test('resolveAnchorPlacementTrackId prefers selected scroll event track', () => {
    assert.equal(
        resolveAnchorPlacementTrackId({
            selectedScrollTrackId: '9',
            focusedTrackId: '7',
            tracks: [
                { id: '7', kind: 'scroll' },
                { id: '8', kind: 'record' },
            ],
        }),
        '9',
    );
});

test('resolveAnchorPlacementTrackId falls back to focused scroll track then first scroll track', () => {
    assert.equal(
        resolveAnchorPlacementTrackId({
            focusedTrackId: '7',
            tracks: [
                { id: '7', kind: 'scroll' },
                { id: '8', kind: 'scroll' },
            ],
        }),
        '7',
    );
    assert.equal(
        resolveAnchorPlacementTrackId({
            focusedTrackId: '6',
            tracks: [
                { id: '6', kind: 'record' },
                { id: '8', kind: 'scrolls' },
            ],
        }),
        '8',
    );
});

test('shouldCreateAnchorScrollTrack returns true only when no scroll track can be resolved', () => {
    assert.equal(
        shouldCreateAnchorScrollTrack({
            focusedTrackId: '6',
            tracks: [{ id: '6', kind: 'record' }],
        }),
        true,
    );
    assert.equal(
        shouldCreateAnchorScrollTrack({
            tracks: [{ id: '8', kind: 'scroll' }],
        }),
        false,
    );
});
