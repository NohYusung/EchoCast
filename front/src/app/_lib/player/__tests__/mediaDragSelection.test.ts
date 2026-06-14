import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    buildMediaDragPayload,
    getNextMediaSelection,
    parseMediaDragPayload,
} from '../mediaDragSelection';

test('getNextMediaSelection toggles clicked media with modifier keys', () => {
    const mediaIds = [10, 11, 12, 13];

    assert.deepEqual(
        getNextMediaSelection({
            currentSelectionIds: [],
            clickedId: 11,
            orderedMediaIds: mediaIds,
            isToggle: false,
            isRange: false,
        }),
        [11],
    );
    assert.deepEqual(
        getNextMediaSelection({
            currentSelectionIds: [10, 11],
            clickedId: 11,
            orderedMediaIds: mediaIds,
            isToggle: true,
            isRange: false,
        }),
        [10],
    );
    assert.deepEqual(
        getNextMediaSelection({
            currentSelectionIds: [10],
            clickedId: 12,
            orderedMediaIds: mediaIds,
            isToggle: true,
            isRange: false,
        }),
        [10, 12],
    );
});

test('getNextMediaSelection expands a range from the last selected media', () => {
    assert.deepEqual(
        getNextMediaSelection({
            currentSelectionIds: [10, 12],
            clickedId: 14,
            orderedMediaIds: [10, 11, 12, 13, 14],
            isToggle: false,
            isRange: true,
        }),
        [12, 13, 14],
    );
});

test('parseMediaDragPayload prefers the selected media batch and dedupes ids', () => {
    const payload = buildMediaDragPayload([12, 10, 12, 0]);

    assert.equal(payload.primaryId, 12);
    assert.deepEqual(parseMediaDragPayload(JSON.stringify(payload.ids), '99'), [12, 10]);
    assert.deepEqual(parseMediaDragPayload('', '99'), [99]);
});
