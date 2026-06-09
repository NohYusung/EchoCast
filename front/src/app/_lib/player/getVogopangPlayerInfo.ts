import { buildVogopangContent } from './vogopangContent';
import { createSamplePlayerDraft } from './sampleDraft';
import type { VogopangContent } from './vogopangContent.types';

export interface VogopangPlayerInfo {
    content: VogopangContent;
    episode: {
        id: string | number;
        title?: string;
        chapter?: string;
    };
}

function readContent(payload: unknown): VogopangContent | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const top = payload as Record<string, unknown>;
    const result = top.result;
    const data = result && typeof result === 'object' ? (result as Record<string, unknown>).data : top.data;
    if (!data || typeof data !== 'object') return undefined;
    const content = (data as Record<string, unknown>).content;
    if (!content || typeof content !== 'object') return undefined;
    const candidate = content as Partial<VogopangContent>;
    return Array.isArray(candidate.images) ? (content as VogopangContent) : undefined;
}

export async function getVogopangPlayerInfo({
    productId = 'product-100',
    episodeId,
}: {
    productId?: string;
    episodeId: string;
}): Promise<VogopangPlayerInfo> {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    const fallbackDraft = createSamplePlayerDraft({ productId, episodeId });
    const fallback = {
        content: buildVogopangContent(fallbackDraft),
        episode: {
            id: episodeId,
            title: fallbackDraft.episodes[0]?.title,
            chapter: String(fallbackDraft.episodes[0]?.episodeNumber ?? 1),
        },
    };
    if (!apiBaseUrl) return fallback;

    try {
        const response = await fetch(`${apiBaseUrl}/player/info`, {
            method: 'POST',
            cache: 'no-store',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                seriesId: productId,
                episodeId,
            }),
        });
        if (!response.ok) return fallback;
        const payload = await response.json();
        const content = readContent(payload);
        if (!content) return fallback;

        return {
            content,
            episode: {
                id: episodeId,
            },
        };
    } catch {
        return fallback;
    }
}
