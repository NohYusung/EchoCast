import type { PlayerManifestItem } from './playerManifest.types';

export function resolveVisualFrame(items: PlayerManifestItem[], currentTime: number) {
    const activeVisual = items.find(
        (item) => item.kind === 'visual' && item.startTime <= currentTime && currentTime < item.endTime
    );

    if (!activeVisual) return { mediaId: null, progress: 0 };

    const duration = Math.max(activeVisual.endTime - activeVisual.startTime, 1);
    return {
        mediaId: activeVisual.mediaId ?? null,
        progress: (currentTime - activeVisual.startTime) / duration,
    };
}
