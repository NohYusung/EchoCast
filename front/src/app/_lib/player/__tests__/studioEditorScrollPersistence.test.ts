import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../StudioEditor.tsx', import.meta.url), 'utf8');

test('scroll event timeline edits update existing anchors instead of creating new anchors', () => {
    const persistScrollEventUpdateBlock = source.match(
        /const persistScrollEventUpdate = async \(event: ScrollEventClip\) => \{[\s\S]*?\n    \};/
    )?.[0];

    assert.ok(persistScrollEventUpdateBlock);
    assert.match(persistScrollEventUpdateBlock, /await updateScrollEventAnchors\(event\)/);
    assert.doesNotMatch(persistScrollEventUpdateBlock, /createScrollEventMutationRequest/);
    assert.doesNotMatch(persistScrollEventUpdateBlock, /createAnchor/);
});
