import test from 'node:test';
import assert from 'node:assert/strict';

import {
    toDialogueCueOverlayTop,
    toDialogueCuePositionRequest,
    toDialogueStripSize,
    toManualDialogueCuePositionRequest,
    toQuickDialogueCharacterRequest,
} from '../studioDialogueCuePlacement';

test('toDialogueCuePositionRequest maps a clicked saved canvas strip position to cue placement fields', () => {
    assert.deepEqual(
        toDialogueCuePositionRequest({
            canvasId: 7,
            medias: [
                { canvasMediaId: 301, mediaId: 11, index: 0 },
                { canvasMediaId: 302, mediaId: 12, index: 1 },
            ],
            stripHeightPx: 360,
            stripPositionPx: 270,
            visualSegments: [
                { id: 'canvas-media-301', canvasId: 7, index: 0, top: 0, height: 180 },
                { id: 'canvas-media-302', canvasId: 7, index: 1, top: 180, height: 180 },
            ],
        }),
        {
            startCanvasMediaId: 302,
            endCanvasMediaId: 302,
            startPosition: 50,
            endPosition: 50,
        },
    );
});

test('toDialogueCuePositionRequest rejects unsaved strip media without canvas media ids', () => {
    assert.equal(
        toDialogueCuePositionRequest({
            canvasId: 7,
            medias: [{ mediaId: 11, index: 0 }],
            stripHeightPx: 180,
            stripPositionPx: 90,
            visualSegments: [{ id: 'canvas-media-11', canvasId: 7, index: 0, top: 0, height: 180 }],
        }),
        undefined,
    );
});

test('toManualDialogueCuePositionRequest maps a selected media and percent value to cue placement fields', () => {
    assert.deepEqual(
        toManualDialogueCuePositionRequest({
            medias: [
                { canvasMediaId: 301, mediaId: 11, index: 0 },
                { canvasMediaId: 302, mediaId: 12, index: 1 },
            ],
            canvasMediaId: 302,
            position: 64.4,
        }),
        {
            startCanvasMediaId: 302,
            endCanvasMediaId: 302,
            startPosition: 64,
            endPosition: 64,
        },
    );
});

test('toManualDialogueCuePositionRequest rejects position values outside the cue percent range', () => {
    assert.equal(
        toManualDialogueCuePositionRequest({
            medias: [{ canvasMediaId: 301, mediaId: 11, index: 0 }],
            canvasMediaId: 301,
            position: 101,
        }),
        undefined,
    );
});

test('toDialogueStripSize scales strip width while preserving media-native height', () => {
    assert.deepEqual(toDialogueStripSize(150), {
        scale: 150,
        width: 480,
        panelWidth: 576,
    });
});

test('toDialogueStripSize clamps strip scale instead of allowing independent ratio changes', () => {
    assert.deepEqual(toDialogueStripSize(1000), {
        scale: 200,
        width: 640,
        panelWidth: 736,
    });
});

test('toDialogueCueOverlayTop keeps dialogue bubbles inside the visible media area', () => {
    assert.equal(toDialogueCueOverlayTop(-20), 8);
    assert.equal(toDialogueCueOverlayTop(0), 8);
    assert.equal(toDialogueCueOverlayTop(47.6), 48);
    assert.equal(toDialogueCueOverlayTop(100), 92);
    assert.equal(toDialogueCueOverlayTop(Number.NaN), 50);
});

test('toQuickDialogueCharacterRequest trims the ad hoc character name and keeps the selected role', () => {
    assert.deepEqual(toQuickDialogueCharacterRequest({ name: '  학생 A  ', role: 'minor' }), {
        name: '학생 A',
        role: 'minor',
    });
});

test('toQuickDialogueCharacterRequest rejects blank ad hoc character names', () => {
    assert.equal(toQuickDialogueCharacterRequest({ name: '   ', role: 'minor' }), undefined);
});
