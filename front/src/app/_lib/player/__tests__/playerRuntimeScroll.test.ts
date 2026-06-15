import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    advancePlayerRuntimePlayhead,
    getPlayerRuntimePlayheadFromScroll,
    shouldSyncPlayerRuntimeScroll,
    toPlayerRuntimeScrollAnchors,
} from '../playerRuntimeScroll';

test('toPlayerRuntimeScrollAnchors keeps manifest anchor time in milliseconds for player playback', () => {
    assert.deepEqual(
        toPlayerRuntimeScrollAnchors([
            {
                id: '1',
                trackId: 'scroll-1',
                canvasId: '11',
                time: 3000,
                index: 1,
                position: 75,
            },
        ]),
        [
            {
                canvasId: '11',
                time: 3000,
                index: 1,
                position: 75,
            },
        ],
    );
});

test('shouldSyncPlayerRuntimeScroll allows anchor-only playback scroll updates', () => {
    assert.equal(shouldSyncPlayerRuntimeScroll([], []), false);
    assert.equal(shouldSyncPlayerRuntimeScroll([], [{ time: 3000, canvasId: '11', index: 1, position: 75 }]), true);
});

test('advancePlayerRuntimePlayhead advances time from the scroll-selected position', () => {
    assert.deepEqual(
        advancePlayerRuntimePlayhead({
            currentTimeMs: 3000,
            elapsedMs: 250,
            durationMs: 10000,
        }),
        {
            playheadMs: 3250,
            isEnded: false,
        },
    );
});

test('advancePlayerRuntimePlayhead clamps at duration and reports playback completion', () => {
    assert.deepEqual(
        advancePlayerRuntimePlayhead({
            currentTimeMs: 9900,
            elapsedMs: 250,
            durationMs: 10000,
        }),
        {
            playheadMs: 10000,
            isEnded: true,
        },
    );
});

test('getPlayerRuntimePlayheadFromScroll uses the nearest anchor time from the current scroll offset', () => {
    assert.equal(
        getPlayerRuntimePlayheadFromScroll({
            scrollTopPx: 390,
            scrollEvents: [],
            anchors: [
                { time: 1000, canvasId: 11, index: 0, position: 50 },
                { time: 5000, canvasId: 11, index: 1, position: 50 },
            ],
            stripHeightPx: 800,
            viewportHeightPx: 200,
            visualSegments: [
                { id: 'clip-1', canvasId: 11, index: 0, top: 0, height: 300 },
                { id: 'clip-2', canvasId: 11, index: 1, top: 300, height: 500 },
            ],
        }),
        5000,
    );
});

test('getPlayerRuntimePlayheadFromScroll falls back to scroll event interpolation when there are no anchors', () => {
    assert.equal(
        getPlayerRuntimePlayheadFromScroll({
            scrollTopPx: 250,
            scrollEvents: [
                {
                    start: 1000,
                    duration: 4000,
                    canvasId: 11,
                    startIndex: 0,
                    endIndex: 1,
                    startPosition: 50,
                    endPosition: 50,
                },
            ],
            anchors: [],
            stripHeightPx: 800,
            viewportHeightPx: 200,
            visualSegments: [
                { id: 'clip-1', canvasId: 11, index: 0, top: 0, height: 300 },
                { id: 'clip-2', canvasId: 11, index: 1, top: 300, height: 500 },
            ],
        }),
        3000,
    );
});

test('getPlayerRuntimePlayheadFromScroll prefers the nearest anchor over scroll event interpolation', () => {
    assert.equal(
        getPlayerRuntimePlayheadFromScroll({
            scrollTopPx: 470,
            scrollEvents: [
                {
                    start: 0,
                    duration: 9000,
                    canvasId: 11,
                    startIndex: 0,
                    endIndex: 1,
                    startPosition: 0,
                    endPosition: 100,
                },
            ],
            anchors: [
                { time: 0, canvasId: 11, index: 0, position: 0 },
                { time: 12000, canvasId: 11, index: 1, position: 0 },
            ],
            stripHeightPx: 1000,
            viewportHeightPx: 200,
            visualSegments: [
                { id: 'video-1', canvasId: 11, index: 0, top: 0, height: 600 },
                { id: 'image-1', canvasId: 11, index: 1, top: 600, height: 400 },
            ],
        }),
        12000,
    );
});

test('getPlayerRuntimePlayheadFromScroll resumes from an exact anchor after a video scroll range', () => {
    assert.equal(
        getPlayerRuntimePlayheadFromScroll({
            scrollTopPx: 500,
            scrollEvents: [
                {
                    start: 0,
                    duration: 9000,
                    canvasId: 11,
                    startIndex: 0,
                    endIndex: 1,
                    startPosition: 0,
                    endPosition: 100,
                },
            ],
            anchors: [
                { time: 12000, canvasId: 11, index: 1, position: 0 },
            ],
            stripHeightPx: 1000,
            viewportHeightPx: 200,
            visualSegments: [
                { id: 'video-1', canvasId: 11, index: 0, top: 0, height: 600 },
                { id: 'image-1', canvasId: 11, index: 1, top: 600, height: 400 },
            ],
        }),
        12000,
    );
});

test('getPlayerRuntimePlayheadFromScroll uses current playhead to disambiguate repeated anchor offsets', () => {
    assert.equal(
        getPlayerRuntimePlayheadFromScroll({
            scrollTopPx: 500,
            currentPlayheadMs: 9000,
            scrollEvents: [],
            anchors: [
                { time: 1000, canvasId: 11, index: 1, position: 0 },
                { time: 12000, canvasId: 11, index: 1, position: 0 },
            ],
            stripHeightPx: 1000,
            viewportHeightPx: 200,
            visualSegments: [
                { id: 'video-1', canvasId: 11, index: 0, top: 0, height: 600 },
                { id: 'image-1', canvasId: 11, index: 1, top: 600, height: 400 },
            ],
        }),
        12000,
    );
});
