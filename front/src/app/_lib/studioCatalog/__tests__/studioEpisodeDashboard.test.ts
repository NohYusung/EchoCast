import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../StudioEpisodeDashboard.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../../styles.css', import.meta.url), 'utf8');

test('episode list exposes recording action with recording copy per episode', () => {
    assert.match(
        source,
        /visibleEpisodes\.map\(\(episode\)[\s\S]*?href=\{`\/studio\/products\/\$\{product\.id\}\/episodes\/\$\{episode\.id\}\/record`\}/,
    );
    assert.match(source, /aria-label=\{`\$\{episode\.title\} 녹음하기`\}/);
    assert.match(source, /녹음 하기\s*<StudioCatalogIcon name="chevronRight" \/>/);
    assert.doesNotMatch(source, /녹음실 입장/);
});

test('episode recording action is revealed by the same row hover affordance as editor action', () => {
    assert.match(
        source,
        /className="tp-open-hint"[\s\S]*?편집기 열기 <StudioCatalogIcon name="chevronRight" \/>[\s\S]*?className="tp-open-hint tp-episode-record-link"[\s\S]*?녹음 하기 <StudioCatalogIcon name="chevronRight" \/>/,
    );
    assert.match(styles, /\.tp-episode-row:hover \.tp-episode-actions[\s\S]*?opacity: 1;/);
    assert.match(styles, /\.tp-episode-actions[\s\S]*?opacity: 0;/);
    assert.doesNotMatch(styles, /\.tp-episode-record-link\s*\{[\s\S]*?border:/);
    assert.doesNotMatch(styles, /\.tp-episode-record-link\s*\{[\s\S]*?background:/);
});

test('episode dashboard does not route recording through the latest product episode hero action', () => {
    assert.doesNotMatch(
        source,
        /href=\{`\/studio\/products\/\$\{product\.id\}\/episodes\/\$\{latestEpisode\.id\}\/record`\}/,
    );
});
