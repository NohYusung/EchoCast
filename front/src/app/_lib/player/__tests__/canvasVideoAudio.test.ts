import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('canvas video elements are not hardcoded as muted', () => {
    const studioEditor = readFileSync(new URL('../StudioEditor.tsx', import.meta.url), 'utf8');
    const playerRuntime = readFileSync(new URL('../PlayerRuntime.tsx', import.meta.url), 'utf8');
    const videoElements = [...`${studioEditor}\n${playerRuntime}`.matchAll(/<video[\s\S]*?\/>/g)].map(
        (match) => match[0],
    );

    assert.ok(videoElements.length >= 3, 'Studio editor and player should render controllable video elements');

    videoElements.forEach((videoElement) => {
        assert.doesNotMatch(videoElement, /\n\s*muted\n/);
    });
});
