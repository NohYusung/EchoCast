import type { PreviewScrollTimedAnchor } from './previewScrollPosition';

type PreviewPlaybackAnchorSource = {
    canvasId?: number | string;
    index?: number;
    position: number;
    time: number;
};

function toPreviewSeconds(time: number) {
    return time >= 1000 ? time / 1000 : time;
}

export function toPreviewPlaybackAnchors(anchors: readonly PreviewPlaybackAnchorSource[]): PreviewScrollTimedAnchor[] {
    return anchors.map((anchor) => ({
        canvasId: anchor.canvasId,
        index: anchor.index,
        position: anchor.position,
        time: toPreviewSeconds(anchor.time),
    }));
}
