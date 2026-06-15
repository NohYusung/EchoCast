import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCreatedCanvasId } from '../cutCanvasCreation';

test('resolveCreatedCanvasId selects the canvas that appeared after create', () => {
    assert.equal(
        resolveCreatedCanvasId(
            [
                { id: 10 },
                { id: 11 },
            ],
            [
                { id: 10 },
                { id: 11 },
                { id: 12 },
            ],
        ),
        12,
    );
});

test('resolveCreatedCanvasId falls back to the last listed canvas when create response has no identifiable delta', () => {
    assert.equal(resolveCreatedCanvasId([], [{ id: 7 }]), 7);
    assert.equal(resolveCreatedCanvasId([{ id: 7 }], [{ id: 7 }]), 7);
    assert.equal(resolveCreatedCanvasId([], []), null);
});
