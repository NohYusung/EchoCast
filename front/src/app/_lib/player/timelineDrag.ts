import type { PlayerManifestItem } from './playerManifest.types';

export const timelineDragMsPerPixel = 20;

export function moveTimelineItemByPixels({
    item,
    deltaPixels,
    durationMs,
    msPerPixel = timelineDragMsPerPixel,
}: {
    item: PlayerManifestItem;
    deltaPixels: number;
    durationMs: number;
    msPerPixel?: number;
}): PlayerManifestItem {
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
