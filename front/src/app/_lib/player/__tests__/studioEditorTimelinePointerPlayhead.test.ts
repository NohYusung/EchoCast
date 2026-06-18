import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../StudioEditor.tsx', import.meta.url), 'utf8');

test('timeline resize edits do not move the playhead', () => {
    assert.match(
        source,
        /function shouldSyncTimelinePointerEditPlayhead\(edit: TimelinePointerEdit\) \{\s*return edit\.mode === 'move';\s*\}/
    );

    const playheadSyncCalls = source.match(/shouldSyncTimelinePointerEditPlayhead\(timelinePointerEdit\)/g) ?? [];
    const timingStartPlayheadCalls = source.match(/setPlayhead\(timing\.start\)/g) ?? [];

    assert.equal(playheadSyncCalls.length, 4);
    assert.equal(timingStartPlayheadCalls.length, 4);
});
