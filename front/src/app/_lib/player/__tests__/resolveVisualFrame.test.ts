import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleManifest } from '../sampleManifest';
import { resolveVisualFrame } from '../resolveVisualFrame';

test('resolveVisualFrame derives visual scroll progress from active visual timeline item', () => {
    assert.deepEqual(resolveVisualFrame(sampleManifest.items, 6000), {
        mediaId: 201,
        progress: 0.5,
    });
});

test('resolveVisualFrame returns an empty visual frame when no visual item is active', () => {
    assert.deepEqual(resolveVisualFrame(sampleManifest.items, 20000), {
        mediaId: null,
        progress: 0,
    });
});

test('sample manifest contract does not expose legacy scroll fields', () => {
    const payload = JSON.stringify(sampleManifest);

    assert.equal(payload.includes('spoints'), false);
    assert.equal(payload.includes('positionRatio'), false);
    assert.equal(payload.includes('top'), false);
});
