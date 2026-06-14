type PreviewCanvasSource = {
    id: number;
    mediaId?: number;
    medias?: Array<unknown>;
};

export type PreviewCanvasOption = {
    id: number;
    label: string;
    mediaCount: number;
};

export function resolvePreviewCanvasId(canvases: Array<{ id: number }>, currentCanvasId: number | null | undefined) {
    if (typeof currentCanvasId === 'number' && canvases.some((canvas) => canvas.id === currentCanvasId)) {
        return currentCanvasId;
    }

    return canvases[0]?.id ?? null;
}

export function filterPreviewCanvasItems<T extends { canvasId?: number | string }>(items: T[], selectedCanvasId: number | null | undefined) {
    if (typeof selectedCanvasId !== 'number') {
        return [];
    }

    return items.filter((item) => item.canvasId === selectedCanvasId);
}

export function getPreviewCanvasOptions(canvases: PreviewCanvasSource[]): PreviewCanvasOption[] {
    return canvases.map((canvas, index) => ({
        id: canvas.id,
        label: `캔버스 ${index + 1}`,
        mediaCount: canvas.medias && canvas.medias.length > 0 ? canvas.medias.length : typeof canvas.mediaId === 'number' ? 1 : 0,
    }));
}
