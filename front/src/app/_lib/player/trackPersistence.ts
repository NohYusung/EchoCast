export type TrackMutationTarget = {
    episodeId: string;
    trackId: string;
};

export function toTrackMutationTarget({
    episodeId,
    trackId,
}: {
    episodeId: string;
    trackId: string;
}): TrackMutationTarget | null {
    const normalizedEpisodeId = episodeId.trim();
    const normalizedTrackId = trackId.trim();

    if (!normalizedEpisodeId || !normalizedTrackId) {
        return null;
    }

    return {
        episodeId: normalizedEpisodeId,
        trackId: normalizedTrackId,
    };
}

export function getTrackDeleteUrl(apiBaseUrl: string, target: TrackMutationTarget) {
    const baseUrl = apiBaseUrl.replace(/\/$/, '');

    return `${baseUrl}/episodes/${target.episodeId}/tracks/${target.trackId}`;
}
