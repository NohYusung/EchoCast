import type { PreviewScrollVisualSegment } from '../player/previewScrollPosition';
import {
    toClickedCuePositionRequest,
    type CueStripPositionRequest,
    type CueStripVisualClip,
} from '../player/cueTimelinePersistence';

export type DialogueCuePlacementMedia = {
    canvasMediaId?: number;
    mediaId: number;
    index?: number;
};

export type DialogueCuePositionRequest = CueStripPositionRequest;
export type QuickDialogueCharacterRole = 'starring' | 'supporting' | 'minor' | 'narrator' | 'unknown';
export type QuickDialogueCharacterRequest = {
    name: string;
    role: QuickDialogueCharacterRole;
};
export type DialogueCueOverlayPlacementInput = {
    cueId: number;
    top: number;
};
export type DialogueCueOverlayPlacement = {
    cueId: number;
    top: number;
    lane: number;
    offsetPx: number;
    connectorWidthPx: number;
};

const defaultDialogueStripWidth = 320;
const dialogueCueOverlayMinTop = 8;
const dialogueCueOverlayMaxTop = 92;
const dialogueCueOverlayLaneGapPercent = 38;
const dialogueCueOverlayBaseOffsetPx = 18;
const dialogueCueOverlayBaseConnectorWidthPx = 16;
const dialogueCueOverlayLaneStepPx = 174;

export function toDialogueVisualId(media: DialogueCuePlacementMedia) {
    return `canvas-media-${media.canvasMediaId ?? media.mediaId}`;
}

export function toDialogueStripSize(scale: number) {
    const normalizedScale = Math.min(200, Math.max(70, Math.round(Number.isFinite(scale) ? scale : 100)));
    const ratio = normalizedScale / 100;
    const width = Math.round(defaultDialogueStripWidth * ratio);

    return {
        scale: normalizedScale,
        width,
        panelWidth: Math.max(420, width + 96),
    };
}

export function toDialogueCueOverlayTop(position: number) {
    if (!Number.isFinite(position)) return 50;

    return Math.min(dialogueCueOverlayMaxTop, Math.max(dialogueCueOverlayMinTop, Math.round(position)));
}

export function toDialogueCueOverlayPlacements(
    cues: readonly DialogueCueOverlayPlacementInput[],
): DialogueCueOverlayPlacement[] {
    const normalizedCues = cues.map((cue, index) => ({
        cueId: cue.cueId,
        top: toDialogueCueOverlayTop(cue.top),
        index,
    }));
    const sortedCues = [...normalizedCues].sort((a, b) => a.top - b.top || a.index - b.index);
    const laneLastTop: number[] = [];
    const placements = new Map<number, DialogueCueOverlayPlacement>();

    sortedCues.forEach((cue) => {
        const availableLaneIndex = laneLastTop.findIndex(
            (lastTop) => cue.top - lastTop >= dialogueCueOverlayLaneGapPercent,
        );
        const lane = availableLaneIndex >= 0 ? availableLaneIndex : laneLastTop.length;
        laneLastTop[lane] = cue.top;
        placements.set(cue.cueId, {
            cueId: cue.cueId,
            top: cue.top,
            lane,
            offsetPx: dialogueCueOverlayBaseOffsetPx + lane * dialogueCueOverlayLaneStepPx,
            connectorWidthPx: dialogueCueOverlayBaseConnectorWidthPx + lane * dialogueCueOverlayLaneStepPx,
        });
    });

    return normalizedCues.map((cue) => {
        const placement = placements.get(cue.cueId);
        if (placement) return placement;

        return {
            cueId: cue.cueId,
            top: cue.top,
            lane: 0,
            offsetPx: dialogueCueOverlayBaseOffsetPx,
            connectorWidthPx: dialogueCueOverlayBaseConnectorWidthPx,
        };
    });
}

export function toQuickDialogueCharacterRequest({
    name,
    role,
}: {
    name: string;
    role: QuickDialogueCharacterRole;
}): QuickDialogueCharacterRequest | undefined {
    const trimmedName = name.trim();

    if (!trimmedName) return undefined;

    return {
        name: trimmedName,
        role,
    };
}

export function toDialogueStripVisualClips({
    canvasId,
    medias,
}: {
    canvasId: number;
    medias: readonly DialogueCuePlacementMedia[];
}): CueStripVisualClip[] {
    return [...medias]
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .filter((media) => typeof media.canvasMediaId === 'number' && Number.isFinite(media.canvasMediaId))
        .map((media, index) => ({
            id: toDialogueVisualId(media),
            canvasId,
            index: media.index ?? index,
            canvasMediaId: media.canvasMediaId,
        }));
}

export function toDialogueCuePositionRequest({
    canvasId,
    medias,
    stripHeightPx,
    stripPositionPx,
    visualSegments,
}: {
    canvasId: number;
    medias: readonly DialogueCuePlacementMedia[];
    stripHeightPx: number;
    stripPositionPx: number;
    visualSegments: readonly PreviewScrollVisualSegment[];
}): DialogueCuePositionRequest | undefined {
    return toClickedCuePositionRequest({
        stripHeightPx,
        stripPositionPx,
        visualClips: toDialogueStripVisualClips({ canvasId, medias }),
        visualSegments,
    });
}

export function toManualDialogueCuePositionRequest({
    medias,
    canvasMediaId,
    position,
}: {
    medias: readonly DialogueCuePlacementMedia[];
    canvasMediaId: number;
    position: number;
}): DialogueCuePositionRequest | undefined {
    const media = medias.find((item) => item.canvasMediaId === canvasMediaId);
    const roundedPosition = Math.round(position);

    if (!media || typeof media.canvasMediaId !== 'number' || !Number.isFinite(roundedPosition) || roundedPosition < 0 || roundedPosition > 100) {
        return undefined;
    }

    return {
        startCanvasMediaId: media.canvasMediaId,
        endCanvasMediaId: media.canvasMediaId,
        startPosition: roundedPosition,
        endPosition: roundedPosition,
    };
}
