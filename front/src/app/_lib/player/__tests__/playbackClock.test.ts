import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advancePlaybackTime, getPlaybackSnapshot } from '../playbackClock';
import { sampleManifest } from '../sampleManifest';

test('advancePlaybackTime clamps playback position to manifest duration', () => {
    assert.equal(advancePlaybackTime(12000, 12800, 1000), 12800);
    assert.equal(advancePlaybackTime(300, 12800, -500), 0);
});

test('getPlaybackSnapshot returns visual frame and active playback events for the same timeline time', () => {
    const snapshot = getPlaybackSnapshot(sampleManifest, 2700);

    assert.equal(snapshot.currentTime, 2700);
    assert.equal(snapshot.visualFrame.mediaId, 201);
    assert.equal(snapshot.activeEvents.length, 1);
    assert.equal(snapshot.activeEvents[0].sourceId, 7002);
});

test('getPlaybackSnapshot marks completion at or after duration', () => {
    const snapshot = getPlaybackSnapshot(sampleManifest, 12800);

    assert.equal(snapshot.isComplete, true);
    assert.equal(snapshot.currentTime, 12800);
});
