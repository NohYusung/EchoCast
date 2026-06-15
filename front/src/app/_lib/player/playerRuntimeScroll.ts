import type { PlayerManifestAnchor, PlayerManifestScroll } from './playerManifest.types';
import {
    getPreviewScrollOffsetForPixel,
    getPreviewScrollPixel,
    type PreviewScrollPositionEvent,
    type PreviewScrollTimedAnchor,
    type PreviewScrollVisualSegment,
} from './previewScrollPosition';

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getOffsetForScrollAnchor({
    canvasId,
    index,
    position,
    stripHeightPx,
    viewportHeightPx,
    visualSegments,
}: {
    canvasId?: number | string;
    index?: number;
    position: number;
    stripHeightPx: number;
    viewportHeightPx: number;
    visualSegments: readonly PreviewScrollVisualSegment[];
}) {
    return getPreviewScrollOffsetForPixel({
        pixel: getPreviewScrollPixel({
            canvasId,
            index,
            position,
            stripHeightPx,
            visualSegments,
        }),
        stripHeightPx,
        viewportHeightPx,
    });
}

function getInterpolatedTime({
    currentOffset,
    startOffset,
    endOffset,
    startTime,
    endTime,
}: {
    currentOffset: number;
    startOffset: number;
    endOffset: number;
    startTime: number;
    endTime: number;
}) {
    if (startOffset === endOffset) {
        return startTime;
    }

    const progress = clamp((currentOffset - startOffset) / (endOffset - startOffset), 0, 1);

    return Math.round(startTime + (endTime - startTime) * progress);
}

export function toPlayerRuntimeScrollEvents(scrolls: readonly PlayerManifestScroll[] = []): PreviewScrollPositionEvent[] {
    return scrolls.map((scroll) => ({
        canvasId: scroll.canvasId,
        start: scroll.startTime,
        duration: Math.max(0, scroll.endTime - scroll.startTime),
        startIndex: scroll.startIndex,
        endIndex: scroll.endIndex,
        startPosition: scroll.startPosition,
        endPosition: scroll.endPosition,
    }));
}

export function toPlayerRuntimeScrollAnchors(anchors: readonly PlayerManifestAnchor[] = []): PreviewScrollTimedAnchor[] {
    return anchors.map((anchor) => ({
        canvasId: anchor.canvasId,
        index: anchor.index,
        position: anchor.position,
        time: anchor.time,
    }));
}

export function shouldSyncPlayerRuntimeScroll(
    scrollEvents: readonly PreviewScrollPositionEvent[],
    anchors: readonly PreviewScrollTimedAnchor[]
) {
    return scrollEvents.length > 0 || anchors.length > 0;
}

export function advancePlayerRuntimePlayhead({
    currentTimeMs,
    elapsedMs,
    durationMs,
}: {
    currentTimeMs: number;
    elapsedMs: number;
    durationMs: number;
}) {
    const safeDurationMs = Math.max(0, durationMs);
    const playheadMs = clamp(currentTimeMs + Math.max(0, elapsedMs), 0, safeDurationMs);

    return {
        playheadMs,
        isEnded: playheadMs >= safeDurationMs,
    };
}

export function getPlayerRuntimePlayheadFromScroll({
    scrollTopPx,
    currentPlayheadMs,
    scrollEvents,
    anchors,
    stripHeightPx,
    viewportHeightPx,
    visualSegments,
}: {
    scrollTopPx: number;
    currentPlayheadMs?: number;
    scrollEvents: readonly PreviewScrollPositionEvent[];
    anchors: readonly PreviewScrollTimedAnchor[];
    stripHeightPx: number;
    viewportHeightPx: number;
    visualSegments: readonly PreviewScrollVisualSegment[];
}) {
    const maxOffsetPx = Math.max(0, Math.round(stripHeightPx) - Math.round(viewportHeightPx));
    const currentOffset = clamp(Math.round(scrollTopPx), 0, maxOffsetPx);
    const anchorPoints = anchors
        .map((anchor) => ({
            offset: getOffsetForScrollAnchor({
                canvasId: anchor.canvasId,
                index: anchor.index,
                position: anchor.position,
                stripHeightPx,
                viewportHeightPx,
                visualSegments,
            }),
            time: anchor.time,
        }))
        .filter((point) => Number.isFinite(point.offset) && Number.isFinite(point.time))
        .sort((a, b) => a.offset - b.offset || a.time - b.time);

    if (anchorPoints.length > 0) {
        const nearestAnchorPoints = anchorPoints
            .map((point) => ({
                ...point,
                distance: Math.abs(point.offset - currentOffset),
            }))
            .sort((a, b) => a.distance - b.distance || a.time - b.time);
        const nearestDistance = nearestAnchorPoints[0].distance;
        const nearestCandidates = nearestAnchorPoints.filter((point) => point.distance === nearestDistance);

        if (typeof currentPlayheadMs === 'number' && Number.isFinite(currentPlayheadMs)) {
            const nextPoint = nearestCandidates
                .filter((point) => point.time >= currentPlayheadMs)
                .sort((a, b) => a.time - b.time)[0];

            if (nextPoint) {
                return nextPoint.time;
            }

            return [...nearestCandidates].sort(
                (a, b) =>
                    Math.abs(a.time - currentPlayheadMs) - Math.abs(b.time - currentPlayheadMs) ||
                    b.time - a.time,
            )[0].time;
        }

        return nearestCandidates[0].time;
    }

    for (const event of [...scrollEvents].sort((a, b) => a.start - b.start)) {
        if (!Number.isFinite(event.duration) || event.duration <= 0) {
            continue;
        }

        const startOffset = getOffsetForScrollAnchor({
            canvasId: event.canvasId,
            index: event.startIndex,
            position: event.startPosition,
            stripHeightPx,
            viewportHeightPx,
            visualSegments,
        });
        const endOffset = getOffsetForScrollAnchor({
            canvasId: event.canvasId,
            index: event.endIndex,
            position: event.endPosition,
            stripHeightPx,
            viewportHeightPx,
            visualSegments,
        });
        const minOffset = Math.min(startOffset, endOffset);
        const maxOffset = Math.max(startOffset, endOffset);

        if (currentOffset < minOffset || currentOffset > maxOffset) {
            continue;
        }

        return getInterpolatedTime({
            currentOffset,
            startOffset,
            endOffset,
            startTime: event.start,
            endTime: event.start + event.duration,
        });
    }

    return undefined;
}
