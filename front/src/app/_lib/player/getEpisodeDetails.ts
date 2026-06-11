export type StudioEpisodeDetails = {
    id: number;
    productId: number;
    episodeNumber: number;
    title: string;
    subTitle?: string;
};

type EpisodeRetrieveResponse = {
    data: StudioEpisodeDetails;
};

function fallbackEpisodeDetails({ productId, episodeId }: { productId: string; episodeId: string }): StudioEpisodeDetails {
    const parsedProductId = Number.parseInt(productId, 10);
    const parsedEpisodeId = Number.parseInt(episodeId, 10);

    return {
        id: Number.isFinite(parsedEpisodeId) ? parsedEpisodeId : 0,
        productId: Number.isFinite(parsedProductId) ? parsedProductId : 0,
        episodeNumber: Number.isFinite(parsedEpisodeId) ? parsedEpisodeId : 0,
        title: `에피소드 ${episodeId}`,
    };
}

export async function getEpisodeDetails({
    productId,
    episodeId,
}: {
    productId: string;
    episodeId: string;
}): Promise<StudioEpisodeDetails> {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4100';
    const fallback = fallbackEpisodeDetails({ productId, episodeId });

    try {
        const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/products/${productId}/episodes/${episodeId}`, {
            cache: 'no-store',
        });
        if (!response.ok) return fallback;

        const result = (await response.json()) as EpisodeRetrieveResponse;
        return result.data;
    } catch {
        return fallback;
    }
}
