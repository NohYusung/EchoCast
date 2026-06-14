import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTimelineScrubState } from '../timelineScrub';

test('getTimelineScrubState preserves playing state while moving the playhead', () => {
    const state = getTimelineScrubState({
        seconds: 24.2,
        timelineDurationSeconds: 72,
        manualTimelineDurationSeconds: 72,
        isPlaying: true,
    });

    assert.equal(state.isPlaying, true);
    assert.equal(state.playhead, 24.2);
    assert.equal(state.manualTimelineDurationSeconds, 72);
});

test('getTimelineScrubState preserves paused state while moving the playhead', () => {
    const state = getTimelineScrubState({
        seconds: 24.2,
        timelineDurationSeconds: 72,
        manualTimelineDurationSeconds: 72,
        isPlaying: false,
    });

    assert.equal(state.isPlaying, false);
    assert.equal(state.playhead, 24.2);
});

test('getTimelineScrubState extends manual duration when scrubbing beyond the current timeline', () => {
    const state = getTimelineScrubState({
        seconds: 84.4,
        timelineDurationSeconds: 72,
        manualTimelineDurationSeconds: 72,
        isPlaying: true,
    });

    assert.equal(state.isPlaying, true);
    assert.equal(state.playhead, 84.4);
    assert.equal(state.manualTimelineDurationSeconds, 85);
});
