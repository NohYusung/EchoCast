import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    clampTimelineAudioResizeTiming,
    getTimelineAudioClipMaxDurationSeconds,
    getTimelineAudioClipResizeMaxDurationSeconds,
    getTimelinePanelResizeHeight,
    getTimelineResizeMinDurationSeconds,
    getTimelineSidebarResizeWidth,
} from '../timelineResize';
import { applyCueAudioTimelineEditTiming, toCueTimingUpdateRequest } from '../cueTimelinePersistence';

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

test('getTimelinePanelResizeHeight does not clamp expanded height to an upper bound', () => {
    assert.equal(
        getTimelinePanelResizeHeight({
            originalHeight: 336,
            pointerStartY: 500,
            pointerCurrentY: -500,
            minHeight: 220,
        }),
        1336,
    );
});

test('getTimelinePanelResizeHeight keeps a minimum height while shrinking', () => {
    assert.equal(
        getTimelinePanelResizeHeight({
            originalHeight: 336,
            pointerStartY: 500,
            pointerCurrentY: 1000,
            minHeight: 220,
        }),
        220,
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

test('getTimelineAudioClipResizeMaxDurationSeconds lets start resize restore trimmed front audio', () => {
    assert.equal(
        getTimelineAudioClipResizeMaxDurationSeconds(
            {
                audioStart: 4,
                audioEnd: 7,
                audioDuration: 12,
            },
            'start',
        ),
        7,
    );
});

test('getTimelineAudioClipResizeMaxDurationSeconds lets end resize restore trimmed tail audio', () => {
    assert.equal(
        getTimelineAudioClipResizeMaxDurationSeconds(
            {
                audioStart: 2,
                audioEnd: 5,
                audioDuration: 12,
            },
            'end',
        ),
        10,
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

test('applyCueAudioTimelineEditTiming trims audio from the front when start is resized', () => {
    assert.deepEqual(
        applyCueAudioTimelineEditTiming(
            {
                start: 10,
                duration: 5,
                audioStart: 2,
                audioEnd: 7,
                audioDuration: 12,
            },
            {
                mode: 'resize-start',
                originalStart: 10,
                originalDuration: 5,
            },
            {
                start: 12,
                duration: 3,
            },
        ),
        {
            start: 12,
            duration: 3,
            audioStart: 4,
            audioEnd: 7,
            audioDuration: 12,
        },
    );
});

test('applyCueAudioTimelineEditTiming trims audio from the end when end is resized', () => {
    assert.deepEqual(
        applyCueAudioTimelineEditTiming(
            {
                start: 10,
                duration: 5,
                audioStart: 2,
                audioEnd: 7,
                audioDuration: 12,
            },
            {
                mode: 'resize-end',
                originalStart: 10,
                originalDuration: 5,
            },
            {
                start: 10,
                duration: 3,
            },
        ),
        {
            start: 10,
            duration: 3,
            audioStart: 2,
            audioEnd: 5,
            audioDuration: 12,
        },
    );
});

test('toCueTimingUpdateRequest sends cue audio trim range with timeline range', () => {
    assert.deepEqual(
        toCueTimingUpdateRequest({
            start: 12,
            duration: 3,
            audioStart: 4,
            audioEnd: 7,
        }),
        {
            startTime: 12000,
            endTime: 15000,
            audioStartTime: 4000,
            audioEndTime: 7000,
        },
    );
});

test('toCueTimingUpdateRequest rejects voice cue timeline duration that differs from script duration', () => {
    assert.throws(
        () =>
            toCueTimingUpdateRequest({
                start: 12,
                duration: 3.2,
                scriptDuration: 3,
                isVoiceCue: true,
                audioStart: 4,
                audioEnd: 7,
            }),
        /대사 duration/,
    );
});

test('toCueTimingUpdateRequest rejects voice cue audio trim range that differs from script duration', () => {
    assert.throws(
        () =>
            toCueTimingUpdateRequest({
                start: 12,
                duration: 3,
                scriptDuration: 3,
                isVoiceCue: true,
                audioStart: 4,
                audioEnd: 7.3,
            }),
        /대사 duration/,
    );
});
