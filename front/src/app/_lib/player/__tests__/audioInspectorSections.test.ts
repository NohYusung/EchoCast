import assert from 'node:assert/strict';
import { test } from 'node:test';
import { audioInspectorSectionIds } from '../audioInspectorSections';

test('audioInspectorSectionIds keeps only actionable audio cue controls', () => {
    assert.deepEqual(audioInspectorSectionIds, ['cueScript', 'timing']);
    assert.equal(audioInspectorSectionIds.includes('analysis' as never), false);
    assert.equal(audioInspectorSectionIds.includes('automation' as never), false);
    assert.equal(audioInspectorSectionIds.includes('tonePreset' as never), false);
    assert.equal(audioInspectorSectionIds.includes('waveform' as never), false);
});
