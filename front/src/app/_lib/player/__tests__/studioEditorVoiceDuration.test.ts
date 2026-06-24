import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../StudioEditor.tsx', import.meta.url), 'utf8');

test('voice timeline clips use script duration as their canonical length', () => {
    assert.match(source, /duration\?: number;/);
    assert.match(source, /scriptDuration\?: number;/);
    assert.match(source, /isVoiceCue\?: boolean;/);
    assert.match(source, /const isVoiceCue = track\.type === 'record';/);
    assert.match(source, /duration: isVoiceCue && scriptDuration !== undefined \? scriptDuration : Math\.max\(end - start, 0\.2\)/);
});

test('voice timeline clips cannot expose resize handles', () => {
    assert.match(source, /isLocked \|\| clip\.isVoiceCue \? null :/);
});
