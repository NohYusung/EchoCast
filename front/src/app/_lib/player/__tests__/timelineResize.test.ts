import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    clampTimelineAudioResizeTiming,
    getTimelineAudioClipMaxDurationSeconds,
    getTimelineResizeMinDurationSeconds,
    getTimelineSidebarResizeWidth,
} from '../timelineResize';

test('getTimelineSidebarResizeWidth adjusts width by horizontal pointer delta', () => {
    assert.equal(
        getTimelineSidebarResizeWidth({
            originalWidth: 184,
            pointerStartX: 320,
            pointerCurrentX: 376,
            minWidth: 150,
            maxWidth: 320,
        }),
        240,
    );
});

test('getTimelineSidebarResizeWidth clamps to the allowed width range', () => {
    assert.equal(
        getTimelineSidebarResizeWidth({
            originalWidth: 184,
            pointerStartX: 320,
            pointerCurrentX: 40,
            minWidth: 150,
            maxWidth: 320,
        }),
        150,
    );
    assert.equal(
        getTimelineSidebarResizeWidth({
            originalWidth: 184,
            pointerStartX: 320,
            pointerCurrentX: 600,
            minWidth: 150,
            maxWidth: 320,
        }),
        320,
    );
});

test('getTimelineAudioClipMaxDurationSeconds prefers the stored source audio range', () => {
    assert.equal(
        getTimelineAudioClipMaxDurationSeconds({
            audioStart: 3,
            audioEnd: 7.5,
            audioDuration: 12,
        }),
        4.5,
    );
});

test('getTimelineAudioClipMaxDurationSeconds falls back to the source audio duration', () => {
    assert.equal(
        getTimelineAudioClipMaxDurationSeconds({
            audioDuration: 8,
        }),
        8,
    );
});

test('clampTimelineAudioResizeTiming prevents end resize from exceeding source duration', () => {
    assert.deepEqual(
        clampTimelineAudioResizeTiming({
            edge: 'end',
            start: 10,
            duration: 9,
            itemEnd: 19,
            maxDuration: 4,
            minDuration: 0.5,
        }),
        {
            start: 10,
            duration: 4,
        },
    );
});

test('clampTimelineAudioResizeTiming prevents start resize from exceeding source duration', () => {
    assert.deepEqual(
        clampTimelineAudioResizeTiming({
            edge: 'start',
            start: 5,
            duration: 9,
            itemEnd: 14,
            maxDuration: 4,
            minDuration: 0.5,
        }),
        {
            start: 10,
            duration: 4,
        },
    );
});

test('getTimelineResizeMinDurationSeconds does not force short source audio over its max duration', () => {
    assert.equal(getTimelineResizeMinDurationSeconds(0.25, 0.5), 0.25);
});
