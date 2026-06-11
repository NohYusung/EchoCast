export type ImageCompositionSource = {
    clipId: string;
    mediaId: number;
    label: string;
    mediaUrl: string;
    order: number;
};

export type ImageCompositionLayer = {
    id: string;
    clipId: string;
    mediaId: number;
    label: string;
    mediaUrl: string;
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
    const layers = sources
        .map((source, index) => {
            const existing = layerByClipId.get(source.clipId);

            return {
                id: existing?.id ?? `image-layer-${source.clipId}`,
                clipId: source.clipId,
                mediaId: source.mediaId,
                label: source.label,
                mediaUrl: source.mediaUrl,
                x: existing?.x ?? 50,
                y: existing?.y ?? 50,
                scale: existing?.scale ?? 1,
                opacity: existing?.opacity ?? 1,
                zIndex: existing?.zIndex ?? index,
                isVisible: existing?.isVisible ?? true,
            };
        })
        .sort((a, b) => a.zIndex - b.zIndex || a.clipId.localeCompare(b.clipId))
        .map((layer, index) => ({ ...layer, zIndex: index }));
    const sourceSignature = sources.map((source) => `${source.clipId}:${source.mediaUrl}`).join('|');
    const currentSignature = current.layers.map((layer) => `${layer.clipId}:${layer.mediaUrl}`).join('|');
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

export function confirmImageCompositionDraft(draft: ImageCompositionDraft, confirmedAt: string): ImageCompositionDraft {
    return {
        ...draft,
        status: 'confirmed',
        confirmedAt,
    };
}

function clampLayerValue(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(Math.max(value, min), max);
}
