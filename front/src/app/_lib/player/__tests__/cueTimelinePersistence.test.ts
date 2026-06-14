import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCueApiIdFromTimelineClipId, toCueMutationTarget, toCueTimingUpdateRequest } from '../cueTimelinePersistence';

test('getCueApiIdFromTimelineClipId extracts numeric cue ids from timeline clip ids', () => {
    assert.equal(getCueApiIdFromTimelineClipId('cue-123'), '123');
});

test('getCueApiIdFromTimelineClipId rejects non cue timeline clip ids', () => {
    assert.equal(getCueApiIdFromTimelineClipId('cue-123-split'), null);
    assert.equal(getCueApiIdFromTimelineClipId('audio-123'), null);
    assert.equal(getCueApiIdFromTimelineClipId('cue-draft'), null);
});

test('toCueTimingUpdateRequest converts timeline seconds into cue API milliseconds', () => {
    assert.deepEqual(
        toCueTimingUpdateRequest({
            start: 1.234,
            duration: 2.345,
        }),
        {
            startTime: 1234,
            endTime: 3579,
        },
    );
});

test('toCueMutationTarget maps persisted cue timeline clips to API ids', () => {
    assert.deepEqual(
        toCueMutationTarget({
            id: 'cue-42',
            track: '7',
        }),
        {
            cueId: '42',
            trackId: '7',
        },
    );
});

test('toCueMutationTarget ignores local-only cue timeline clips', () => {
    assert.equal(
        toCueMutationTarget({
            id: 'cue-42-split',
            track: '7',
        }),
        null,
    );
});
