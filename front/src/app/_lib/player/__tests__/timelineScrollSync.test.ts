import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syncTimelineVerticalScroll } from '../timelineScrollSync';

test('syncTimelineVerticalScroll moves the track header column with timeline lanes', () => {
    const trackHeaders = { scrollTop: 0 };

    syncTimelineVerticalScroll(trackHeaders, 148);

    assert.equal(trackHeaders.scrollTop, 148);
});

test('syncTimelineVerticalScroll tolerates a missing track header column', () => {
    assert.doesNotThrow(() => syncTimelineVerticalScroll(null, 96));
});
