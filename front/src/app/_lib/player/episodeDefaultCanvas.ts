export async function updateEpisodeDefaultCanvas(
    apiBaseUrl: string,
    {
        productId,
        episodeId,
        defaultCanvasId,
    }: {
        productId: string;
        episodeId: string;
        defaultCanvasId: number;
    }
) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/products/${productId}/episodes/${episodeId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ defaultCanvasId }),
    });

    if (!response.ok) {
        throw new Error(`Episode default canvas update failed: ${response.status}`);
    }
}
