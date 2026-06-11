import { sampleManifest } from './sampleManifest';
import type { PlayerManifest } from './playerManifest.types';

interface PlayerManifestResponse {
    data?: PlayerManifest;
}

function fallbackManifest(episodeId: string): PlayerManifest {
    return {
        ...sampleManifest,
        episodeId,
    };
}

export async function getPlayerManifest(episodeId: string): Promise<PlayerManifest> {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl) return fallbackManifest(episodeId);

    try {
        const response = await fetch(`${apiBaseUrl}/player/manifest/${episodeId}`, {
            cache: 'no-store',
        });
        if (!response.ok) return fallbackManifest(episodeId);
        const result = (await response.json()) as PlayerManifestResponse;
        return result.data ?? fallbackManifest(episodeId);
    } catch {
        return fallbackManifest(episodeId);
    }
}
