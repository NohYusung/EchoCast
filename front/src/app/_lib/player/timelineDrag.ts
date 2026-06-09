import type { TimelineItemManifest } from './playerManifest.types';

export const timelineDragMsPerPixel = 20;

export function moveTimelineItemByPixels({
    item,
    deltaPixels,
    durationMs,
    msPerPixel = timelineDragMsPerPixel,
}: {
    item: TimelineItemManifest;
    deltaPixels: number;
    durationMs: number;
    msPerPixel?: number;
}): TimelineItemManifest {
    const itemDuration = Math.max(item.endTime - item.startTime, 1);
    const deltaMs = Math.round(deltaPixels * msPerPixel);
    const maxStartTime = Math.max(durationMs - itemDuration, 0);
    const nextStartTime = Math.min(Math.max(item.startTime + deltaMs, 0), maxStartTime);

    return {
        ...item,
        startTime: nextStartTime,
        endTime: nextStartTime + itemDuration,
    };
}
