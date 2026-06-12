export type PreviewScrollPositionEvent = {
    start: number;
    duration: number;
    previewStartPx: number;
    previewEndPx: number;
};

export type PreviewSelectableVisual = {
    id: string;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getCoordinateHeight(stripHeightPx: number) {
    return Math.max(1, Math.round(Number.isFinite(stripHeightPx) ? stripHeightPx : 1));
}

export function getPreviewScrollPosition({
    playhead,
    scrollEvents,
    stripHeightPx,
}: {
    playhead: number;
    scrollEvents: readonly PreviewScrollPositionEvent[];
    stripHeightPx: number;
}) {
    const coordinateHeightPx = getCoordinateHeight(stripHeightPx);
    const activeScrollEvent = scrollEvents.find((event) => playhead >= event.start && playhead < event.start + event.duration);

    if (!activeScrollEvent) {
        return undefined;
    }

    const progress = activeScrollEvent.duration > 0 ? clamp((playhead - activeScrollEvent.start) / activeScrollEvent.duration, 0, 1) : 0;

    return clamp(
        activeScrollEvent.previewStartPx + (activeScrollEvent.previewEndPx - activeScrollEvent.previewStartPx) * progress,
        0,
        coordinateHeightPx,
    );
}

export function getSelectedPreviewVisual<TVisual extends PreviewSelectableVisual>(visualClips: readonly TVisual[], selectedId: string) {
    return visualClips.find((clip) => clip.id === selectedId);
}
