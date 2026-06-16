import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../StudioEpisodeDashboard.tsx', import.meta.url), 'utf8');

test('episode list exposes recording studio entry per episode', () => {
    assert.match(
        source,
        /visibleEpisodes\.map\(\(episode\)[\s\S]*?href=\{`\/studio\/products\/\$\{product\.id\}\/episodes\/\$\{episode\.id\}\/record`\}/,
    );
});

test('episode dashboard does not route recording through the latest product episode hero action', () => {
    assert.doesNotMatch(
        source,
        /href=\{`\/studio\/products\/\$\{product\.id\}\/episodes\/\$\{latestEpisode\.id\}\/record`\}/,
    );
});
