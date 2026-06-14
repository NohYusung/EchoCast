import { getPreviewScrollAnchor, type PreviewScrollVisualSegment } from './previewScrollPosition';

export type ScrollEventMutationSource = {
    id: string;
    track?: string;
    scrollId?: number;
    startAnchorId?: number;
    endAnchorId?: number;
    canvasId?: number;
    startIndex?: number;
    endIndex?: number;
    start: number;
    duration: number;
    startPosition: number;
    endPosition: number;
};

export type ScrollEventMutationRequest = {
    startAnchorId: number;
    endAnchorId: number;
};

export type ScrollAnchorMutationRequest = {
    canvasId: number;
    time: number;
    position: number;
    index: number;
};

export type SingleScrollAnchorMutationSource = {
    canvasId?: number;
    index?: number;
    playhead: number;
    position?: number;
};

export type ClickedScrollAnchorMutationSource = {
    playhead: number;
    stripHeightPx: number;
    stripPositionPx: number;
    visualSegments: readonly PreviewScrollVisualSegment[];
};
export type DraggedScrollAnchorMutationSource = {
    anchor: {
        canvasId: number;
        index: number;
        time: number;
        position: number;
    };
    stripHeightPx: number;
    stripPositionPx: number;
    visualSegments: readonly PreviewScrollVisualSegment[];
};
export type TimelineDraggedScrollAnchorMutationSource = {
    anchor: {
        canvasId: number;
        index: number;
        time: number;
        position: number;
    };
    timeSeconds: number;
};

export function getScrollEventApiId(event: { id: string; scrollId?: number }) {
    if (typeof event.scrollId === 'number' && Number.isFinite(event.scrollId)) {
        return event.scrollId;
    }

    const match = /^scroll-(\d+)$/.exec(event.id);
    return match ? Number(match[1]) : undefined;
}

export function toScrollEventMutationRequest(event: ScrollEventMutationSource): ScrollEventMutationRequest | undefined {
    if (
        typeof event.startAnchorId !== 'number' ||
        !Number.isFinite(event.startAnchorId) ||
        typeof event.endAnchorId !== 'number' ||
        !Number.isFinite(event.endAnchorId)
    ) {
        return undefined;
    }

    return {
        startAnchorId: event.startAnchorId,
        endAnchorId: event.endAnchorId,
    };
}

export function toScrollAnchorMutationRequests(event: ScrollEventMutationSource) {
    if (
        typeof event.canvasId !== 'number' ||
        !Number.isFinite(event.canvasId) ||
        typeof event.startIndex !== 'number' ||
        !Number.isFinite(event.startIndex) ||
        typeof event.endIndex !== 'number' ||
        !Number.isFinite(event.endIndex)
    ) {
        return undefined;
    }

    return {
        start: {
            canvasId: event.canvasId,
            time: Math.round(event.start * 1000),
            position: Math.round(event.startPosition),
            index: event.startIndex,
        },
        end: {
            canvasId: event.canvasId,
            time: Math.round((event.start + event.duration) * 1000),
            position: Math.round(event.endPosition),
            index: event.endIndex,
        },
    };
}

export function toSingleScrollAnchorMutationRequest({
    canvasId,
    index,
    playhead,
    position,
}: SingleScrollAnchorMutationSource): ScrollAnchorMutationRequest | undefined {
    if (
        typeof canvasId !== 'number' ||
        !Number.isFinite(canvasId) ||
        typeof index !== 'number' ||
        !Number.isFinite(index) ||
        typeof playhead !== 'number' ||
        !Number.isFinite(playhead) ||
        typeof position !== 'number' ||
        !Number.isFinite(position) ||
        position < 0 ||
        position > 100
    ) {
        return undefined;
    }

    return {
        canvasId,
        index,
        time: Math.round(playhead * 1000),
        position: Math.round(position),
    };
}

export function toClickedScrollAnchorMutationRequest({
    playhead,
    stripHeightPx,
    stripPositionPx,
    visualSegments,
}: ClickedScrollAnchorMutationSource): ScrollAnchorMutationRequest | undefined {
    const anchor = getPreviewScrollAnchor({
        stripPositionPx,
        stripHeightPx,
        visualSegments,
    });

    return toSingleScrollAnchorMutationRequest({
        canvasId: typeof anchor.canvasId === 'number' ? anchor.canvasId : undefined,
        index: anchor.index,
        playhead,
        position: anchor.position,
    });
}

export function toDraggedScrollAnchorMutationRequest({
    anchor: originalAnchor,
    stripHeightPx,
    stripPositionPx,
    visualSegments,
}: DraggedScrollAnchorMutationSource): ScrollAnchorMutationRequest | undefined {
    const anchor = getPreviewScrollAnchor({
        stripPositionPx,
        stripHeightPx,
        visualSegments,
    });

    if (typeof anchor.canvasId !== 'number' || typeof anchor.index !== 'number') {
        return undefined;
    }

    return toSingleScrollAnchorMutationRequest({
        canvasId: anchor.canvasId,
        index: anchor.index,
        playhead: originalAnchor.time / 1000,
        position: anchor.position,
    });
}

export function toTimelineDraggedScrollAnchorMutationRequest({
    anchor,
    timeSeconds,
}: TimelineDraggedScrollAnchorMutationSource): ScrollAnchorMutationRequest | undefined {
    return toSingleScrollAnchorMutationRequest({
        canvasId: anchor.canvasId,
        index: anchor.index,
        playhead: timeSeconds,
        position: anchor.position,
    });
}
