import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moveTimelineItemByPixels } from '../timelineDrag';
import type { PlayerManifestItem } from '../playerManifest.types';

const item: PlayerManifestItem = {
    id: 'cue-item-5002',
    trackId: 'track-dialogue',
    kind: 'cue',
    startTime: 2600,
    endTime: 6200,
    cueId: 'cue-5002',
    layerId: 1,
    volume: 1,
};

test('moveTimelineItemByPixels moves a timeline item while preserving duration', () => {
    const moved = moveTimelineItemByPixels({
        item,
        deltaPixels: 30,
        durationMs: 12800,
    });

    assert.equal(moved.startTime, 3200);
    assert.equal(moved.endTime, 6800);
});

test('moveTimelineItemByPixels clamps movement to the manifest duration', () => {
    const moved = moveTimelineItemByPixels({
        item: {
            ...item,
            startTime: 7800,
            endTime: 12800,
        },
        deltaPixels: 100,
        durationMs: 12800,
    });

    assert.equal(moved.startTime, 7800);
    assert.equal(moved.endTime, 12800);
});
