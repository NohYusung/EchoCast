export type PreviewScrollPositionEvent = {
    start: number;
    duration: number;
    canvasId?: number | string;
    startIndex?: number;
    endIndex?: number;
    startPosition: number;
    endPosition: number;
};

export type PreviewSelectableVisual = {
    id: string;
};

export type PreviewScrollVisualSegment = {
    id: string;
    canvasId?: number | string;
    index?: number;
    top: number;
    height: number;
};

export type PreviewScrollAnchor = {
    visualId?: string;
    canvasId?: number | string;
    index?: number;
    position: number;
};

export type PreviewScrollTimedAnchor = PreviewScrollAnchor & {
    time: number;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getCoordinateHeight(stripHeightPx: number) {
    return Math.max(1, Math.round(Number.isFinite(stripHeightPx) ? stripHeightPx : 1));
}

function getFiniteNumber(value: number, fallback: number) {
    return Number.isFinite(value) ? value : fallback;
}

function getOrderedSegments(visualSegments: readonly PreviewScrollVisualSegment[]) {
    return visualSegments
        .filter((segment) => Number.isFinite(segment.top) && Number.isFinite(segment.height) && segment.height > 0)
        .map((segment) => ({
            ...segment,
            top: Math.max(0, segment.top),
            height: Math.max(1, segment.height),
        }))
        .sort((a, b) => a.top - b.top || (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
}

export function getPreviewScrollAnchor({
    stripPositionPx,
    stripHeightPx,
    visualSegments,
}: {
    stripPositionPx: number;
    stripHeightPx: number;
    visualSegments: readonly PreviewScrollVisualSegment[];
}): PreviewScrollAnchor {
    const coordinateHeightPx = getCoordinateHeight(stripHeightPx);
    const clampedStripPositionPx = clamp(Math.round(getFiniteNumber(stripPositionPx, 0)), 0, coordinateHeightPx);
    const segments = getOrderedSegments(visualSegments);

    if (segments.length === 0) {
        return {
            position: Number(((clampedStripPositionPx / coordinateHeightPx) * 100).toFixed(2)),
        };
    }

    const segment =
        segments.find((item, index) => clampedStripPositionPx < item.top + item.height || index === segments.length - 1) ??
        segments[segments.length - 1];

    return {
        visualId: segment.id,
        canvasId: segment.canvasId,
        index: segment.index,
        position: Number(((clamp(clampedStripPositionPx - segment.top, 0, segment.height) / segment.height) * 100).toFixed(2)),
    };
}

export function getPreviewScrollPixel({
    canvasId,
    index,
    position,
    stripHeightPx,
    visualSegments,
}: {
    canvasId?: number | string;
    index?: number;
    position: number;
    stripHeightPx: number;
    visualSegments: readonly PreviewScrollVisualSegment[];
}) {
    const coordinateHeightPx = getCoordinateHeight(stripHeightPx);
    const segments = getOrderedSegments(visualSegments);
    const fallbackPosition = clamp(
        Math.round((clamp(getFiniteNumber(position, 0), 0, 100) / 100) * coordinateHeightPx),
        0,
        coordinateHeightPx,
    );

    if (segments.length === 0) {
        return fallbackPosition;
    }

    const exactSegment = segments.find(
        (segment) =>
            (canvasId === undefined || segment.canvasId === canvasId) &&
            (typeof index !== 'number' || segment.index === index),
    );
    const indexSegment = exactSegment ?? (typeof index === 'number' ? segments.find((segment) => segment.index === index) : undefined);

    if (!indexSegment) {
        return fallbackPosition;
    }

    return clamp(Math.round(indexSegment.top + (clamp(position, 0, 100) / 100) * indexSegment.height), 0, coordinateHeightPx);
}

export function getPreviewScrollPosition({
    playhead,
    scrollEvents,
    anchors = [],
    stripHeightPx,
    visualSegments = [],
}: {
    playhead: number;
    scrollEvents: readonly PreviewScrollPositionEvent[];
    anchors?: readonly PreviewScrollTimedAnchor[];
    stripHeightPx: number;
    visualSegments?: readonly PreviewScrollVisualSegment[];
}) {
    const coordinateHeightPx = getCoordinateHeight(stripHeightPx);
    const orderedEvents = [...scrollEvents].sort((a, b) => a.start - b.start);
    const activeScrollEvent = orderedEvents.find((event) => playhead >= event.start && playhead < event.start + event.duration);

    if (!activeScrollEvent) {
        const lastCompletedEvent = [...orderedEvents].reverse().find((event) => playhead >= event.start + event.duration);

        if (!lastCompletedEvent) {
            const latestAnchor = [...anchors]
                .filter((anchor) => Number.isFinite(anchor.time) && playhead >= anchor.time)
                .sort((a, b) => b.time - a.time)[0];

            if (!latestAnchor) {
                return undefined;
            }

            return getPreviewScrollPixel({
                canvasId: latestAnchor.canvasId,
                index: latestAnchor.index,
                position: latestAnchor.position,
                stripHeightPx: coordinateHeightPx,
                visualSegments,
            });
        }

        return getPreviewScrollPixel({
            canvasId: lastCompletedEvent.canvasId,
            index: lastCompletedEvent.endIndex,
            position: lastCompletedEvent.endPosition,
            stripHeightPx: coordinateHeightPx,
            visualSegments,
        });
    }

    if (!Number.isFinite(activeScrollEvent.duration) || activeScrollEvent.duration <= 0) {
        return undefined;
    }

    const progress = clamp((playhead - activeScrollEvent.start) / activeScrollEvent.duration, 0, 1);
    const startPx = getPreviewScrollPixel({
        canvasId: activeScrollEvent.canvasId,
        index: activeScrollEvent.startIndex,
        position: activeScrollEvent.startPosition,
        stripHeightPx: coordinateHeightPx,
        visualSegments,
    });
    const endPx = getPreviewScrollPixel({
        canvasId: activeScrollEvent.canvasId,
        index: activeScrollEvent.endIndex,
        position: activeScrollEvent.endPosition,
        stripHeightPx: coordinateHeightPx,
        visualSegments,
    });

    return clamp(
        startPx + (endPx - startPx) * progress,
        0,
        coordinateHeightPx,
    );
}

export function getPreviewScrollOffset({
    playhead,
    scrollEvents,
    anchors = [],
    stripHeightPx,
    viewportHeightPx,
    visualSegments = [],
}: {
    playhead: number;
    scrollEvents: readonly PreviewScrollPositionEvent[];
    anchors?: readonly PreviewScrollTimedAnchor[];
    stripHeightPx: number;
    viewportHeightPx: number;
    visualSegments?: readonly PreviewScrollVisualSegment[];
}) {
    const anchorPixel = getPreviewScrollPosition({ playhead, scrollEvents, anchors, stripHeightPx, visualSegments });

    if (anchorPixel === undefined) {
        return undefined;
    }

    return getPreviewScrollOffsetForPixel({
        pixel: anchorPixel,
        stripHeightPx,
        viewportHeightPx,
    });
}

export function getPreviewScrollOffsetForAnchor({
    canvasId,
    index,
    position,
    stripHeightPx,
    viewportHeightPx,
    visualSegments = [],
}: {
    canvasId?: number | string;
    index?: number;
    position: number;
    stripHeightPx: number;
    viewportHeightPx: number;
    visualSegments?: readonly PreviewScrollVisualSegment[];
}) {
    const anchorPixel = getPreviewScrollPixel({
        canvasId,
        index,
        position,
        stripHeightPx,
        visualSegments,
    });

    return getPreviewScrollOffsetForPixel({
        pixel: anchorPixel,
        stripHeightPx,
        viewportHeightPx,
    });
}

export function getPreviewScrollOffsetForPixel({
    pixel,
    stripHeightPx,
    viewportHeightPx,
}: {
    pixel: number;
    stripHeightPx: number;
    viewportHeightPx: number;
}) {
    const coordinateHeightPx = getCoordinateHeight(stripHeightPx);
    const viewportHeight = getCoordinateHeight(viewportHeightPx);
    const viewportCenterPx = viewportHeight / 2;
    const maxOffsetPx = Math.max(0, coordinateHeightPx - viewportHeight);

    return clamp(Math.round(pixel - viewportCenterPx), 0, maxOffsetPx);
}

export function resolvePreviewScrollOffset({
    isPlaying,
    playbackOffsetPx,
    selectedAnchorOffsetPx,
}: {
    isPlaying: boolean;
    playbackOffsetPx: number | undefined;
    selectedAnchorOffsetPx: number | undefined;
}) {
    if (isPlaying) {
        return playbackOffsetPx;
    }

    return selectedAnchorOffsetPx ?? playbackOffsetPx;
}

export function getSelectedPreviewVisual<TVisual extends PreviewSelectableVisual>(visualClips: readonly TVisual[], selectedId: string) {
    return visualClips.find((clip) => clip.id === selectedId);
}
