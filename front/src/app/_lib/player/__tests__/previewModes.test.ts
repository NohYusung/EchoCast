import assert from 'node:assert/strict';
import { test } from 'node:test';
import { previewModeDefinitions } from '../previewModes';

test('previewModeDefinitions exposes preview and cut edit without the removed effect tab', () => {
    assert.deepEqual(
        previewModeDefinitions.map((mode) => mode.label),
        ['미리보기', '컷 편집'],
    );
    assert.equal(previewModeDefinitions.some((mode) => mode.label === '이펙트'), false);
});
