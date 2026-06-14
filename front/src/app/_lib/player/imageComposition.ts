export type ImageCompositionSource = {
    clipId: string;
    canvasId?: number;
    mediaId: number;
    mediaType: 'image' | 'video';
    label: string;
    mediaUrl: string;
    order: number;
};

export type ImageCompositionLayer = {
    id: string;
    clipId: string;
    canvasId?: number;
    mediaId: number;
    mediaType: 'image' | 'video';
    label: string;
    mediaUrl: string;
    sourceOrder: number;
    x: number;
    y: number;
    scale: number;
    opacity: number;
    zIndex: number;
    isVisible: boolean;
};

export type ImageCompositionDraft = {
    layers: ImageCompositionLayer[];
    selectedLayerId: string;
    status: 'editing' | 'confirmed';
    confirmedAt?: string;
};

export type ImageCompositionLayerPatch = Partial<Pick<ImageCompositionLayer, 'x' | 'y' | 'scale' | 'opacity' | 'isVisible'>>;
export type ImageCompositionCanvasMedia = {
    mediaId: number;
    mediaName: string;
    mediaType: 'image' | 'video';
    mediaUrl: string;
    index: number;
    x: number;
    y: number;
    scale: number;
    opacity: number;
};

const MIN_POSITION = 0;
const MAX_POSITION = 100;
const MIN_SCALE = 0.35;
const MAX_SCALE = 1.8;
const MIN_OPACITY = 0.2;
const MAX_OPACITY = 1;

export function createEmptyImageCompositionDraft(): ImageCompositionDraft {
    return {
        layers: [],
        selectedLayerId: '',
        status: 'editing',
    };
}

export function syncImageCompositionDraft(
    sources: ImageCompositionSource[],
    current: ImageCompositionDraft = createEmptyImageCompositionDraft(),
): ImageCompositionDraft {
    const layerByClipId = new Map(current.layers.map((layer) => [layer.clipId, layer]));
    const shouldUseSourceOrder = sources.some((source, index) => {
        const existing = layerByClipId.get(source.clipId);

        return existing ? (existing.sourceOrder ?? existing.zIndex) !== index : false;
    });
    const layers = sources
        .map((source, index) => {
            const existing = layerByClipId.get(source.clipId);

            return {
                id: existing?.id ?? `image-layer-${source.clipId}`,
                clipId: source.clipId,
                canvasId: source.canvasId ?? existing?.canvasId,
                mediaId: source.mediaId,
                mediaType: source.mediaType,
                label: source.label,
                mediaUrl: source.mediaUrl,
                sourceOrder: index,
                x: existing?.x ?? 50,
                y: existing?.y ?? 50,
                scale: existing?.scale ?? 1,
                opacity: existing?.opacity ?? 1,
                zIndex: shouldUseSourceOrder ? index : existing?.zIndex ?? index,
                isVisible: existing?.isVisible ?? true,
            };
        })
        .sort((a, b) => a.zIndex - b.zIndex || a.clipId.localeCompare(b.clipId))
        .map((layer, index) => ({ ...layer, zIndex: index }));
    const sourceSignature = sources
        .map((source) => `${source.clipId}:${source.canvasId ?? 'new'}:${source.mediaType}:${source.mediaUrl}`)
        .join('|');
    const currentSignature = [...current.layers]
        .sort((a, b) => (a.sourceOrder ?? a.zIndex) - (b.sourceOrder ?? b.zIndex) || a.clipId.localeCompare(b.clipId))
        .map((layer) => `${layer.clipId}:${layer.canvasId ?? 'new'}:${layer.mediaType}:${layer.mediaUrl}`)
        .join('|');
    const selectedLayerId = layers.some((layer) => layer.id === current.selectedLayerId)
        ? current.selectedLayerId
        : layers[0]?.id ?? '';

    return {
        layers,
        selectedLayerId,
        status: sourceSignature === currentSignature ? current.status : 'editing',
        confirmedAt: sourceSignature === currentSignature ? current.confirmedAt : undefined,
    };
}

export function selectImageCompositionLayer(draft: ImageCompositionDraft, layerId: string): ImageCompositionDraft {
    if (!draft.layers.some((layer) => layer.id === layerId)) {
        return draft;
    }

    return {
        ...draft,
        selectedLayerId: layerId,
    };
}

export function updateImageCompositionLayer(
    draft: ImageCompositionDraft,
    layerId: string,
    patch: ImageCompositionLayerPatch,
): ImageCompositionDraft {
    return {
        layers: draft.layers.map((layer) =>
            layer.id === layerId
                ? {
                      ...layer,
                      ...patch,
                      x: clampLayerValue(patch.x ?? layer.x, MIN_POSITION, MAX_POSITION),
                      y: clampLayerValue(patch.y ?? layer.y, MIN_POSITION, MAX_POSITION),
                      scale: clampLayerValue(patch.scale ?? layer.scale, MIN_SCALE, MAX_SCALE),
                      opacity: clampLayerValue(patch.opacity ?? layer.opacity, MIN_OPACITY, MAX_OPACITY),
                  }
                : layer,
        ),
        selectedLayerId: draft.selectedLayerId,
        status: 'editing',
    };
}

export function moveImageCompositionLayer(
    draft: ImageCompositionDraft,
    layerId: string,
    direction: 'up' | 'down',
): ImageCompositionDraft {
    const layers = [...draft.layers].sort((a, b) => a.zIndex - b.zIndex || a.clipId.localeCompare(b.clipId));
    const layerIndex = layers.findIndex((layer) => layer.id === layerId);
    const targetIndex = direction === 'up' ? layerIndex + 1 : layerIndex - 1;

    if (layerIndex < 0 || targetIndex < 0 || targetIndex >= layers.length) {
        return draft;
    }

    const nextLayers = [...layers];
    [nextLayers[layerIndex], nextLayers[targetIndex]] = [nextLayers[targetIndex], nextLayers[layerIndex]];

    return {
        layers: nextLayers.map((layer, index) => ({ ...layer, zIndex: index })),
        selectedLayerId: draft.selectedLayerId,
        status: 'editing',
    };
}

export function removeImageCompositionLayer(draft: ImageCompositionDraft, layerId: string): ImageCompositionDraft {
    const layers = [...draft.layers].sort((a, b) => a.zIndex - b.zIndex || a.clipId.localeCompare(b.clipId));
    const removedIndex = layers.findIndex((layer) => layer.id === layerId);

    if (removedIndex < 0) {
        return draft;
    }

    const nextLayers = layers.filter((layer) => layer.id !== layerId).map((layer, index) => ({ ...layer, zIndex: index }));
    const nextSelectedLayerId =
        draft.selectedLayerId === layerId || !nextLayers.some((layer) => layer.id === draft.selectedLayerId)
            ? nextLayers[Math.min(removedIndex, nextLayers.length - 1)]?.id ?? ''
            : draft.selectedLayerId;

    return {
        layers: nextLayers,
        selectedLayerId: nextSelectedLayerId,
        status: 'editing',
    };
}

export function confirmImageCompositionDraft(draft: ImageCompositionDraft, confirmedAt: string): ImageCompositionDraft {
    return {
        ...draft,
        status: 'confirmed',
        confirmedAt,
    };
}

export function toCanvasCreateMedias(
    draft: ImageCompositionDraft,
    options: { canvasId?: number | null } = {},
): ImageCompositionCanvasMedia[] {
    const hasCanvasFilter = Object.prototype.hasOwnProperty.call(options, 'canvasId');

    return [...draft.layers]
        .filter((layer) => {
            if (!layer.isVisible) {
                return false;
            }

            if (!hasCanvasFilter) {
                return true;
            }

            if (options.canvasId === null) {
                return typeof layer.canvasId !== 'number';
            }

            return layer.canvasId === options.canvasId;
        })
        .sort((a, b) => a.zIndex - b.zIndex || a.clipId.localeCompare(b.clipId))
        .map((layer, index) => ({
            mediaId: layer.mediaId,
            mediaName: layer.label,
            mediaType: layer.mediaType,
            mediaUrl: layer.mediaUrl,
            index,
            x: layer.x,
            y: layer.y,
            scale: layer.scale,
            opacity: layer.opacity,
        }));
}

function clampLayerValue(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(Math.max(value, min), max);
}
