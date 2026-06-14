export type AnchorMutationTarget = {
    trackId: string;
    anchorId: number;
};

type AnchorPlacementTrackCandidate = {
    id: string;
    kind?: string;
};

function isAnchorScrollTrackKind(kind: string | undefined) {
    return kind === 'scroll' || kind === 'scrolls';
}

export function resolveAnchorPlacementTrackId({
    selectedScrollTrackId,
    focusedTrackId,
    tracks,
}: {
    selectedScrollTrackId?: string;
    focusedTrackId?: string;
    tracks: AnchorPlacementTrackCandidate[];
}) {
    if (selectedScrollTrackId) {
        return selectedScrollTrackId;
    }

    const focusedScrollTrack = tracks.find((track) => track.id === focusedTrackId && isAnchorScrollTrackKind(track.kind));

    return focusedScrollTrack?.id ?? tracks.find((track) => isAnchorScrollTrackKind(track.kind))?.id ?? null;
}

export function shouldCreateAnchorScrollTrack({
    selectedScrollTrackId,
    focusedTrackId,
    tracks,
}: {
    selectedScrollTrackId?: string;
    focusedTrackId?: string;
    tracks: AnchorPlacementTrackCandidate[];
}) {
    return resolveAnchorPlacementTrackId({ selectedScrollTrackId, focusedTrackId, tracks }) === null;
}

export function toAnchorMutationTarget({
    trackId,
    anchorId,
}: {
    trackId: string;
    anchorId: number;
}): AnchorMutationTarget | null {
    const normalizedTrackId = trackId.trim();

    if (!normalizedTrackId || !Number.isInteger(anchorId) || anchorId <= 0) {
        return null;
    }

    return {
        trackId: normalizedTrackId,
        anchorId,
    };
}

export function getAnchorDeleteUrl(apiBaseUrl: string, target: AnchorMutationTarget) {
    const baseUrl = apiBaseUrl.replace(/\/$/, '');

    return `${baseUrl}/tracks/${target.trackId}/anchors/${target.anchorId}`;
}

export function getAnchorEventDeleteUrl(apiBaseUrl: string, target: AnchorMutationTarget) {
    return `${getAnchorDeleteUrl(apiBaseUrl, target)}/event`;
}
