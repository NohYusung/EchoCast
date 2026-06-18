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

test('default scroll tracks render timeline items as scroll events', () => {
    assert.match(source, /const DEFAULT_SCROLL_TRACK_NAME = '새 스크롤 트랙'/);
    assert.match(source, /return `새 스크롤 이벤트\$\{eventNumber\}`/);
    assert.match(source, /label: getScrollEventLabel\(track\.name, index\)/);
    assert.doesNotMatch(source, /label: `\$\{track\.name\} \$\{index \+ 1\}`/);
});

test('anchor inspector labels its linked event as a scroll event', () => {
    assert.match(source, /<h3>스크롤 이벤트<\/h3>/);
    assert.match(source, /스크롤 이벤트 저장에 실패했습니다/);
    assert.match(source, /스크롤 이벤트 삭제에 실패했습니다/);
    assert.doesNotMatch(source, />앵커 이벤트</);
    assert.doesNotMatch(source, /앵커 이벤트 저장에 실패했습니다/);
    assert.doesNotMatch(source, /앵커 이벤트 삭제에 실패했습니다/);
});
