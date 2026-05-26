export interface LocalPlayerIndexItem {
  playerKey: string;
  title: string;
  subtitle?: string;
}

const SAFE_PLAYER_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

export function normalizePlayerKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  if (!SAFE_PLAYER_KEY_PATTERN.test(key)) return null;
  return key;
}

export function getLocalPlayerJsonPath(playerKey: string): string | null {
  const safeKey = normalizePlayerKey(playerKey);
  if (!safeKey) return null;
  return `/json/player/${safeKey}.json`;
}

export function parsePlayerIndex(raw: unknown): LocalPlayerIndexItem[] {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const players = Array.isArray(record?.players) ? record.players : [];

  return players.flatMap((item): LocalPlayerIndexItem[] => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const playerKey = normalizePlayerKey(entry.playerKey);
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const subtitle = typeof entry.subtitle === "string" ? entry.subtitle.trim() : "";

    if (!playerKey || !title) return [];
    return [
      {
        playerKey,
        title,
        ...(subtitle ? { subtitle } : {}),
      },
    ];
  });
}

export async function fetchLocalPlayerIndex(): Promise<LocalPlayerIndexItem[]> {
  const response = await fetch("/json/player/index.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load player index: HTTP ${response.status}`);
  }
  return parsePlayerIndex(await response.json());
}
