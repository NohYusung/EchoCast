type TimelineSidebarResizeArgs = {
    originalWidth: number;
    pointerStartX: number;
    pointerCurrentX: number;
    minWidth: number;
    maxWidth: number;
};

type TimelinePanelResizeHeightArgs = {
    originalHeight: number;
    pointerStartY: number;
    pointerCurrentY: number;
    minHeight: number;
};

type TimelineAudioDurationSource = {
    audioStart?: number;
    audioEnd?: number;
    audioDuration?: number;
};

type TimelineAudioResizeTimingArgs = {
    edge: 'start' | 'end';
    start: number;
    duration: number;
    itemEnd: number;
    maxDuration?: number;
    minDuration: number;
};

function toPositiveFiniteDuration(value: number | undefined) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function getTimelineSidebarResizeWidth({
    originalWidth,
    pointerStartX,
    pointerCurrentX,
    minWidth,
    maxWidth,
}: TimelineSidebarResizeArgs) {
    const nextWidth = originalWidth + (pointerCurrentX - pointerStartX);

    return Math.round(Math.min(Math.max(nextWidth, minWidth), maxWidth));
}

export function getTimelinePanelResizeHeight({
    originalHeight,
    pointerStartY,
    pointerCurrentY,
    minHeight,
}: TimelinePanelResizeHeightArgs) {
    const nextHeight = originalHeight - (pointerCurrentY - pointerStartY);

    return Math.round(Math.max(nextHeight, minHeight));
}

export function getTimelineAudioClipMaxDurationSeconds({
    audioStart,
    audioEnd,
    audioDuration,
}: TimelineAudioDurationSource) {
    const sourceRangeDuration =
        typeof audioStart === 'number' &&
        typeof audioEnd === 'number' &&
        Number.isFinite(audioStart) &&
        Number.isFinite(audioEnd) &&
        audioEnd > audioStart
            ? audioEnd - audioStart
            : undefined;

    return toPositiveFiniteDuration(sourceRangeDuration) ?? toPositiveFiniteDuration(audioDuration);
}

export function getTimelineResizeMinDurationSeconds(maxDuration: number | undefined, fallbackMinDuration: number) {
    const normalizedMaxDuration = toPositiveFiniteDuration(maxDuration);

    if (normalizedMaxDuration === undefined) {
        return fallbackMinDuration;
    }

    return Math.min(fallbackMinDuration, normalizedMaxDuration);
}

export function clampTimelineAudioResizeTiming({
    edge,
    start,
    duration,
    itemEnd,
    maxDuration,
    minDuration,
}: TimelineAudioResizeTimingArgs) {
    const normalizedMaxDuration = toPositiveFiniteDuration(maxDuration);

    if (normalizedMaxDuration === undefined) {
        return { start, duration };
    }

    const normalizedMinDuration = Math.min(Math.max(minDuration, 0), normalizedMaxDuration);

    if (edge === 'start') {
        const nextStart = Math.max(start, itemEnd - normalizedMaxDuration);

        return {
            start: nextStart,
            duration: Math.max(normalizedMinDuration, itemEnd - nextStart),
        };
    }

    return {
        start,
        duration: Math.min(Math.max(duration, normalizedMinDuration), normalizedMaxDuration),
    };
}
