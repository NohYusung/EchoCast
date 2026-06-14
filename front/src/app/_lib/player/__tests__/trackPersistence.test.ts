import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTrackDeleteUrl, toTrackMutationTarget } from '../trackPersistence';

test('toTrackMutationTarget maps episode and track ids to the track delete API target', () => {
    assert.deepEqual(
        toTrackMutationTarget({
            episodeId: '1',
            trackId: '7',
        }),
        {
            episodeId: '1',
            trackId: '7',
        },
    );
});

test('toTrackMutationTarget rejects missing track ids', () => {
    assert.equal(
        toTrackMutationTarget({
            episodeId: '1',
            trackId: '',
        }),
        null,
    );
});

test('getTrackDeleteUrl builds the backend track delete URL', () => {
    assert.equal(getTrackDeleteUrl('http://127.0.0.1:4100/', { episodeId: '1', trackId: '7' }), 'http://127.0.0.1:4100/episodes/1/tracks/7');
});
