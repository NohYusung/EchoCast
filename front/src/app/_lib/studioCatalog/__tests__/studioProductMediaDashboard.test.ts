import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../StudioProductMediaDashboard.tsx', import.meta.url), 'utf8');

test('canvas media source list renders every visual media item', () => {
    const sourceListMatch = source.match(
        /<div className="tp-canvas-source-list">([\s\S]*?)<\/div>\s*<\/div>\s*<\/aside>/
    );

    assert.ok(sourceListMatch);
    assert.match(sourceListMatch[1] ?? '', /\.filter\(\(media\) => media\.mediaType !== 'audio'\)/);
    assert.doesNotMatch(sourceListMatch[1] ?? '', /\.slice\(0,\s*8\)/);
});
