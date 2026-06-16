import type { StudioEpisodeDetails } from './getEpisodeDetails';
import type { PlayerManifest } from './playerManifest.types';

export function shouldLoadPlayerManifestForEditor(episode: Pick<StudioEpisodeDetails, 'defaultCanvasId'>) {
    return typeof episode.defaultCanvasId === 'number';
}

export function createEmptyEditorManifest(episodeId: string | number): PlayerManifest {
    const parsedEpisodeId = typeof episodeId === 'number' ? episodeId : Number.parseInt(episodeId, 10);

    return {
        episodeId: Number.isFinite(parsedEpisodeId) ? parsedEpisodeId : 0,
        totalDuration: 0,
        tracks: [],
        items: [],
        scrolls: [],
        anchors: [],
        cues: [],
        canvases: [],
        media: [],
        records: [],
        tts: [],
    };
}

export async function loadEditorInitialManifest({
    episodeId,
    episode,
    loadManifest,
}: {
    episodeId: string;
    episode: Pick<StudioEpisodeDetails, 'defaultCanvasId'>;
    loadManifest: (episodeId: string) => Promise<PlayerManifest>;
}) {
    if (!shouldLoadPlayerManifestForEditor(episode)) {
        return createEmptyEditorManifest(episodeId);
    }

    return loadManifest(episodeId);
}
