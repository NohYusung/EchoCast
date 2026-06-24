import { getPreviewScrollAnchor, getPreviewScrollPixel, type PreviewScrollVisualSegment } from './previewScrollPosition';

export type CueTimelineTiming = {
    start: number;
    duration: number;
    audioStart?: number;
    audioEnd?: number;
    isVoiceCue?: boolean;
    scriptDuration?: number;
};

export type CueTimingUpdateRequest = {
    startTime: number;
    endTime: number;
    audioStartTime?: number;
    audioEndTime?: number;
};

export type CueAudioTimelineEditMode = 'move' | 'resize-start' | 'resize-end';

export type CueAudioTimelineEdit = {
    mode: CueAudioTimelineEditMode;
    originalStart: number;
    originalDuration: number;
};

export type CueAudioTimelineClip = CueTimelineTiming & {
    audioDuration?: number;
};

const voiceCueDurationToleranceMs = 50;

export type CueStripPositionRequest = {
    startCanvasMediaId: number;
    endCanvasMediaId: number;
    startPosition: number;
    endPosition: number;
};

export type CueMutationTimelineClip = {
    id: string;
    track: string;
};

export type CueStripVisualClip = {
    id: string;
    canvasId?: number;
    index?: number;
    canvasMediaId?: number;
};

export type CueStripMarkerSource = {
    startCanvasMediaId?: number;
    endCanvasMediaId?: number;
    startPosition: number;
    endPosition: number;
};

export type CueStripMarker = {
    top: number;
    endTop: number;
};

function getCueStripPosition({
    stripHeightPx,
    stripPositionPx,
    visualClips,
    visualSegments,
}: {
    stripHeightPx: number;
    stripPositionPx: number;
    visualClips: readonly CueStripVisualClip[];
    visualSegments: readonly PreviewScrollVisualSegment[];
}) {
    const anchor = getPreviewScrollAnchor({
        stripHeightPx,
        stripPositionPx,
        visualSegments,
    });
    const segment = visualSegments.find(
        (item) =>
            item.id === anchor.visualId ||
            (typeof anchor.canvasId === 'number' && item.canvasId === anchor.canvasId && item.index === anchor.index),
    );
    const clip =
        visualClips.find((item) => item.id === segment?.id) ??
        visualClips.find(
            (item) =>
                typeof anchor.canvasId === 'number' &&
                item.canvasId === anchor.canvasId &&
                (typeof anchor.index !== 'number' || item.index === anchor.index),
        );

    if (typeof clip?.canvasMediaId !== 'number' || !Number.isFinite(clip.canvasMediaId)) {
        return undefined;
    }

    const position = Math.round(anchor.position);

    if (!Number.isFinite(position) || position < 0 || position > 100) {
        return undefined;
    }

    return {
        canvasMediaId: clip.canvasMediaId,
        position,
    };
}

export function getCueApiIdFromTimelineClipId(clipId: string) {
    const match = /^cue-(\d+)$/.exec(clipId);

    return match?.[1] ?? null;
}

export function toCueMutationTarget(clip: CueMutationTimelineClip) {
    const cueId = getCueApiIdFromTimelineClipId(clip.id);

    if (!cueId) {
        return null;
    }

    return {
        trackId: clip.track,
        cueId,
    };
}

export function resolveCueTimelineTrackId({
    parentTrackId,
    cueTrackId,
}: {
    parentTrackId: string | number;
    cueTrackId?: string | number;
}) {
    if (typeof cueTrackId === 'number' && Number.isFinite(cueTrackId)) {
        return String(cueTrackId);
    }
    if (typeof cueTrackId === 'string' && cueTrackId.trim()) {
        return cueTrackId;
    }

    return String(parentTrackId);
}

function toDurationMilliseconds(durationSeconds: number | undefined) {
    return typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
        ? Math.round(durationSeconds * 1000)
        : undefined;
}

function assertVoiceCueDurationMatchesScript({
    actualDurationMs,
    scriptDurationMs,
}: {
    actualDurationMs: number;
    scriptDurationMs: number;
}) {
    if (Math.abs(actualDurationMs - scriptDurationMs) > voiceCueDurationToleranceMs) {
        throw new Error('보이스 큐 길이는 대사 duration과 같아야 합니다.');
    }
}

export function toCueTimingUpdateRequest(timing: CueTimelineTiming): CueTimingUpdateRequest {
    const startTime = Math.round(timing.start * 1000);
    const endTime = Math.round((timing.start + timing.duration) * 1000);
    const audioStartTime =
        typeof timing.audioStart === 'number' ? Math.round(timing.audioStart * 1000) : undefined;
    const audioEndTime = typeof timing.audioEnd === 'number' ? Math.round(timing.audioEnd * 1000) : undefined;
    const scriptDurationMs = toDurationMilliseconds(timing.scriptDuration);

    if (timing.isVoiceCue && scriptDurationMs !== undefined) {
        assertVoiceCueDurationMatchesScript({
            actualDurationMs: endTime - startTime,
            scriptDurationMs,
        });

        if (audioStartTime !== undefined && audioEndTime !== undefined) {
            assertVoiceCueDurationMatchesScript({
                actualDurationMs: audioEndTime - audioStartTime,
                scriptDurationMs,
            });
        }
    }

    return {
        startTime,
        endTime,
        ...(audioStartTime !== undefined ? { audioStartTime } : {}),
        ...(audioEndTime !== undefined ? { audioEndTime } : {}),
    };
}

function toFiniteAudioTime(value: number | undefined) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function applyCueAudioTimelineEditTiming<TClip extends CueAudioTimelineClip>(
    clip: TClip,
    edit: CueAudioTimelineEdit,
    timing: CueTimelineTiming,
): TClip {
    const nextClip = {
        ...clip,
        start: timing.start,
        duration: timing.duration,
    };

    if (edit.mode === 'move') {
        return nextClip;
    }

    const audioStart = toFiniteAudioTime(clip.audioStart) ?? 0;
    const explicitAudioEnd = toFiniteAudioTime(clip.audioEnd);
    const audioDuration = toFiniteAudioTime(clip.audioDuration);
    const audioEnd =
        explicitAudioEnd !== undefined && explicitAudioEnd > audioStart
            ? explicitAudioEnd
            : audioDuration !== undefined
              ? Math.min(audioDuration, audioStart + edit.originalDuration)
              : undefined;

    if (audioEnd === undefined || audioEnd <= audioStart) {
        return nextClip;
    }

    if (edit.mode === 'resize-start') {
        return {
            ...nextClip,
            audioStart: Math.max(0, Math.min(audioEnd, audioEnd - timing.duration)),
            audioEnd,
        };
    }

    return {
        ...nextClip,
        audioStart,
        audioEnd: audioDuration !== undefined ? Math.min(audioDuration, audioStart + timing.duration) : audioStart + timing.duration,
    };
}

export function toClickedCuePositionRequest({
    stripHeightPx,
    stripPositionPx,
    visualClips,
    visualSegments,
}: {
    stripHeightPx: number;
    stripPositionPx: number;
    visualClips: readonly CueStripVisualClip[];
    visualSegments: readonly PreviewScrollVisualSegment[];
}): CueStripPositionRequest | undefined {
    return toCuePositionUpdateRequest({
        stripHeightPx,
        startStripPositionPx: stripPositionPx,
        endStripPositionPx: stripPositionPx,
        visualClips,
        visualSegments,
    });
}

export function toCuePositionUpdateRequest({
    stripHeightPx,
    startStripPositionPx,
    endStripPositionPx,
    visualClips,
    visualSegments,
}: {
    stripHeightPx: number;
    startStripPositionPx: number;
    endStripPositionPx: number;
    visualClips: readonly CueStripVisualClip[];
    visualSegments: readonly PreviewScrollVisualSegment[];
}): CueStripPositionRequest | undefined {
    const start = getCueStripPosition({
        stripHeightPx,
        stripPositionPx: startStripPositionPx,
        visualClips,
        visualSegments,
    });
    const end = getCueStripPosition({
        stripHeightPx,
        stripPositionPx: endStripPositionPx,
        visualClips,
        visualSegments,
    });

    if (!start || !end) {
        return undefined;
    }

    return {
        startCanvasMediaId: start.canvasMediaId,
        endCanvasMediaId: end.canvasMediaId,
        startPosition: start.position,
        endPosition: end.position,
    };
}

export function toCueStripMarker({
    cue,
    stripHeightPx,
    visualClips,
    visualSegments,
}: {
    cue: CueStripMarkerSource;
    stripHeightPx: number;
    visualClips: readonly CueStripVisualClip[];
    visualSegments: readonly PreviewScrollVisualSegment[];
}): CueStripMarker | undefined {
    const startClip =
        typeof cue.startCanvasMediaId === 'number'
            ? visualClips.find((clip) => clip.canvasMediaId === cue.startCanvasMediaId)
            : visualClips[0];
    const endClip =
        typeof cue.endCanvasMediaId === 'number'
            ? visualClips.find((clip) => clip.canvasMediaId === cue.endCanvasMediaId) ?? startClip
            : startClip;

    if (!startClip || !endClip) {
        return undefined;
    }

    const top = getPreviewScrollPixel({
        canvasId: startClip.canvasId,
        index: startClip.index,
        position: cue.startPosition,
        stripHeightPx,
        visualSegments,
    });
    const endTop = getPreviewScrollPixel({
        canvasId: endClip.canvasId,
        index: endClip.index,
        position: cue.endPosition,
        stripHeightPx,
        visualSegments,
    });

    if (typeof top !== 'number' || typeof endTop !== 'number') {
        return undefined;
    }

    return {
        top,
        endTop,
    };
}
