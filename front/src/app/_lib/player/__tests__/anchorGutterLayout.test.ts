import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function getCssRuleBlock(styles: string, selector: string) {
    const start = styles.indexOf(`${selector} {`);

    assert.notEqual(start, -1, `${selector} rule should exist`);

    const bodyStart = styles.indexOf('{', start);
    const bodyEnd = styles.indexOf('\n}', bodyStart);

    assert.notEqual(bodyStart, -1, `${selector} rule should have an opening brace`);
    assert.notEqual(bodyEnd, -1, `${selector} rule should have a closing brace`);

    return styles.slice(bodyStart + 1, bodyEnd);
}

test('cut edit anchors use an outside gutter handle instead of covering the image', () => {
    const styles = readFileSync(new URL('../../../styles.css', import.meta.url), 'utf8');
    const studioEditor = readFileSync(new URL('../StudioEditor.tsx', import.meta.url), 'utf8');
    const markerRule = getCssRuleBlock(styles, '.odx-preview-anchor-marker');
    const handleRule = getCssRuleBlock(styles, '.odx-preview-anchor-handle');
    const placementRule = getCssRuleBlock(styles, '.odx-anchor-placement-layer');

    assert.match(markerRule, /left:\s*calc\(var\(--odx-anchor-gutter\) \* -1\)/);
    assert.match(markerRule, /right:\s*calc\(\(var\(--odx-anchor-overhang\) \* -1\) - var\(--odx-cue-track-panel-width,\s*0px\)\)/);
    assert.match(markerRule, /pointer-events:\s*none/);
    assert.match(handleRule, /width:\s*var\(--odx-anchor-gutter\)/);
    assert.match(handleRule, /pointer-events:\s*auto/);
    assert.match(placementRule, /left:\s*calc\(var\(--odx-anchor-gutter\) \* -1\)/);
    assert.match(placementRule, /width:\s*var\(--odx-anchor-gutter\)/);
    assert.match(studioEditor, /className="odx-preview-anchor-handle/);
});

test('cut edit keeps the right inspector visible when an item is selected', () => {
    const styles = readFileSync(new URL('../../../styles.css', import.meta.url), 'utf8');
    const studioEditor = readFileSync(new URL('../StudioEditor.tsx', import.meta.url), 'utf8');
    const cutEditInspectorRule = getCssRuleBlock(styles, '.odx-body.is-editing-cuts.has-cut-edit-inspector');
    const cutEditInspectorVisibilityRule = getCssRuleBlock(styles, '.odx-body.is-editing-cuts.has-cut-edit-inspector .odx-inspector');

    assert.match(studioEditor, /const shouldShowCutEditInspector = Boolean\(selectedItem\)/);
    assert.match(studioEditor, /shouldShowCutEditInspector \? 'has-cut-edit-inspector' : ''/);
    assert.match(cutEditInspectorRule, /grid-template-columns:\s*54px 296px minmax\(360px, 1fr\) var\(--odx-inspector-width, 312px\)/);
    assert.match(cutEditInspectorVisibilityRule, /display:\s*grid/);
});

test('canvas visual clips do not divide canvas media into equal timeline durations', () => {
    const visualClips = readFileSync(new URL('../visualClips.ts', import.meta.url), 'utf8');

    assert.doesNotMatch(visualClips, /TIMELINE_DURATION_SECONDS\s*\/\s*visualItems\.length/);
    assert.match(visualClips, /function getCanvasMediaClipDurationSeconds/);
    assert.match(visualClips, /item\.mediaType === 'video'/);
});

test('player video media uses preview contain sizing instead of cropping', () => {
    const styles = readFileSync(new URL('../../../styles.css', import.meta.url), 'utf8');
    const playerVideoRule = getCssRuleBlock(styles, '.vpp-scene.is-video .vpp-media');

    assert.match(playerVideoRule, /height:\s*auto/);
    assert.match(playerVideoRule, /object-fit:\s*contain/);
    assert.doesNotMatch(playerVideoRule, /object-fit:\s*cover/);
});
