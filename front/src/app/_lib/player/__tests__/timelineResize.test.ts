import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTimelineSidebarResizeWidth } from '../timelineResize';

test('getTimelineSidebarResizeWidth adjusts width by horizontal pointer delta', () => {
    assert.equal(
        getTimelineSidebarResizeWidth({
            originalWidth: 184,
            pointerStartX: 320,
            pointerCurrentX: 376,
            minWidth: 150,
            maxWidth: 320,
        }),
        240,
    );
});

test('getTimelineSidebarResizeWidth clamps to the allowed width range', () => {
    assert.equal(
        getTimelineSidebarResizeWidth({
            originalWidth: 184,
            pointerStartX: 320,
            pointerCurrentX: 40,
            minWidth: 150,
            maxWidth: 320,
        }),
        150,
    );
    assert.equal(
        getTimelineSidebarResizeWidth({
            originalWidth: 184,
            pointerStartX: 320,
            pointerCurrentX: 600,
            minWidth: 150,
            maxWidth: 320,
        }),
        320,
    );
});
