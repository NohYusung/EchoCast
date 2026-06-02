import { apiClient } from "@/api/client";
import type { PlaybackManifest, PlayerManifestVariant } from "@/models/playback";

type PlayerManifestApiResponse = {
  data: PlaybackManifest;
};

export async function getPlayerManifest(
  manifestId: string,
  variant?: PlayerManifestVariant,
): Promise<PlaybackManifest> {
  const query = variant ? `?variant=${encodeURIComponent(variant)}` : "";
  const res = await apiClient.get<PlayerManifestApiResponse>(
    `/player/manifest/${encodeURIComponent(manifestId)}${query}`,
  );
  return res.data;
}

