import type { PlayerManifest } from './playerManifest.types';

interface PlayerManifestResponse {
    data?: PlayerManifest;
}

export async function getPlayerManifest(episodeId: string): Promise<PlayerManifest> {
    const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4100').replace(/\/$/, '');
    const response = await fetch(`${apiBaseUrl}/player/manifest/${episodeId}`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Player manifest request failed: ${response.status}`);
    }

    const result = (await response.json()) as PlayerManifestResponse;

    if (!result.data) {
        throw new Error('Player manifest response is empty');
    }

    return result.data;
}
