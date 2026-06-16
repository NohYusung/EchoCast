import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createEmptyEditorManifest,
    loadEditorInitialManifest,
    shouldLoadPlayerManifestForEditor,
} from '../editorInitialManifest';

test('shouldLoadPlayerManifestForEditor only requires the player manifest after a default canvas exists', () => {
    assert.equal(shouldLoadPlayerManifestForEditor({ defaultCanvasId: undefined }), false);
    assert.equal(shouldLoadPlayerManifestForEditor({ defaultCanvasId: 7 }), true);
});

test('createEmptyEditorManifest builds an editor-only manifest for fresh episodes', () => {
    assert.deepEqual(createEmptyEditorManifest('12'), {
        episodeId: 12,
        totalDuration: 0,
        tracks: [],
        items: [],
        scrolls: [],
        anchors: [],
        cues: [],
        canvases: [],
        media: [],
        records: [],
        tts: [],
    });
});

test('loadEditorInitialManifest does not call the player manifest loader before default canvas selection', async () => {
    const manifest = await loadEditorInitialManifest({
        episodeId: '12',
        episode: { defaultCanvasId: undefined },
        loadManifest: async () => {
            throw new Error('player manifest loader should not be called');
        },
    });

    assert.equal(manifest.episodeId, 12);
    assert.deepEqual(manifest.canvases, []);
});

test('loadEditorInitialManifest loads the player manifest after default canvas selection', async () => {
    const manifest = await loadEditorInitialManifest({
        episodeId: '12',
        episode: { defaultCanvasId: 7 },
        loadManifest: async (episodeId) => ({
            ...createEmptyEditorManifest(episodeId),
            previewCanvasId: 7,
        }),
    });

    assert.equal(manifest.previewCanvasId, 7);
});
