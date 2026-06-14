import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('canvas video elements are not hardcoded as muted', () => {
    const studioEditor = readFileSync(new URL('../StudioEditor.tsx', import.meta.url), 'utf8');
    const videoElements = [...studioEditor.matchAll(/<video[\s\S]*?\/>/g)].map((match) => match[0]);

    assert.ok(videoElements.length >= 2, 'Studio editor should render cut edit and preview video elements');

    videoElements.forEach((videoElement) => {
        assert.doesNotMatch(videoElement, /\n\s*muted\n/);
    });
});
