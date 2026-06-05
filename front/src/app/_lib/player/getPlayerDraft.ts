import { createSamplePlayerDraft } from "./sampleDraft";
import type { PlayerDraft } from "./playerDraft.types";

export async function getPlayerDraft({
  productId,
  episodeId,
}: {
  productId: string;
  episodeId: string;
}): Promise<PlayerDraft> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const fallbackDraft = createSamplePlayerDraft({ productId, episodeId });
  if (!apiBaseUrl) return fallbackDraft;

  try {
    const response = await fetch(`${apiBaseUrl}/episodes/${episodeId}/player-draft`, {
      cache: "no-store",
    });
    if (!response.ok) return fallbackDraft;
    return (await response.json()) as PlayerDraft;
  } catch {
    return fallbackDraft;
  }
}
