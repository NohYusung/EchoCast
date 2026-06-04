import { sampleManifest } from "./sampleManifest";
import type { PlayerManifest } from "./playerManifest.types";

export async function getPlayerManifest(
  episodeId: string,
): Promise<PlayerManifest> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) return sampleManifest;

  try {
    const response = await fetch(`${apiBaseUrl}/player/manifest/${episodeId}`, {
      cache: "no-store",
    });
    if (!response.ok) return sampleManifest;
    return (await response.json()) as PlayerManifest;
  } catch {
    return sampleManifest;
  }
}
