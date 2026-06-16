import type { PlayerDraft } from './playerDraft.types';
import type { PlayerManifest, PlayerTrackKind } from './playerManifest.types';

type ProductRetrieveItem = {
    id: number | string;
    title: string;
    coverImageUrl?: string;
};

type EpisodeRetrieveItem = {
    id: number | string;
    productId: number | string;
    episodeNumber: number;
    title: string;
    subTitle?: string;
    defaultCanvasId?: number | string;
};

type CharacterListItem = {
    id: number | string;
    name: string;
};

type TrackApiType = PlayerTrackKind;

type TrackCueListItem = {
    id: number | string;
    script: string;
    characterId?: number | string | null;
    trackId: number | string;
    audioId?: number | string | null;
    startCanvasMediaId?: number | string | null;
    endCanvasMediaId?: number | string | null;
    startTime: number;
    endTime: number;
    audioStartTime?: number;
    audioEndTime?: number;
    startPosition?: number;
    endPosition?: number;
    volume?: number;
};

type TrackListItem = {
    id: number | string;
    episodeId: number | string;
    name: string;
    type: TrackApiType;
    characterId?: number | string | null;
    isMuted: boolean;
    cues?: TrackCueListItem[];
};

type ApiDataResponse<T> = {
    data?: T;
};

type ApiListResponse<T> = {
    data?: {
        items?: T[];
    };
};

type PlayerDraftParams = {
    productId: string;
    episodeId: string;
    canvasId?: string;
};

export async function getPlayerDraft({ productId, episodeId, canvasId }: PlayerDraftParams): Promise<PlayerDraft> {
    const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4100').replace(/\/$/, '');
    const fallbackDraft = createEmptyPlayerDraft({ productId, episodeId });
    const manifestUrl = new URL(`${apiBaseUrl}/player/manifest/${episodeId}`);
    if (canvasId) {
        manifestUrl.searchParams.set('canvasId', canvasId);
    }

    try {
        const [product, episode, characters, tracks, manifest] = await Promise.all([
            retrieveApiData<ProductRetrieveItem>(`${apiBaseUrl}/products/${productId}`),
            retrieveApiData<EpisodeRetrieveItem>(`${apiBaseUrl}/products/${productId}/episodes/${episodeId}`),
            listApiItems<CharacterListItem>(`${apiBaseUrl}/products/${productId}/characters`),
            listApiItems<TrackListItem>(`${apiBaseUrl}/episodes/${episodeId}/tracks`),
            retrieveApiData<PlayerManifest>(manifestUrl.toString()),
        ]);

        return toPlayerDraft({
            productId,
            episodeId,
            product,
            episode,
            characters,
            tracks,
            manifest,
        });
    } catch {
        return fallbackDraft;
    }
}

async function retrieveApiData<T>(url: string): Promise<T> {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }

    const result = (await response.json()) as ApiDataResponse<T>;

    if (!result.data) {
        throw new Error('API response is empty');
    }

    return result.data;
}

async function listApiItems<T>(url: string): Promise<T[]> {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }

    const result = (await response.json()) as ApiListResponse<T>;
    return result.data?.items ?? [];
}

function toPlayerDraft({
    productId,
    episodeId,
    product,
    episode,
    characters,
    tracks,
    manifest,
}: PlayerDraftParams & {
    product: ProductRetrieveItem;
    episode: EpisodeRetrieveItem;
    characters: CharacterListItem[];
    tracks: TrackListItem[];
    manifest: PlayerManifest;
}): PlayerDraft {
    const recordingCueEntries = tracks
        .flatMap((track) => (track.cues ?? []).map((cue) => ({ track, cue })))
        .filter(({ track, cue }) => typeof resolveCueCharacterId(track, cue) === 'number')
        .sort((left, right) => left.cue.startTime - right.cue.startTime || toNumericId(left.cue.id) - toNumericId(right.cue.id));
    const manifestCuesById = new Map(manifest.cues.map((cue) => [cue.id, cue]));
    const productNumericId = toNumericId(product.id, toNumericId(productId));
    const episodeNumericId = toNumericId(episode.id, toNumericId(episodeId));

    return {
        products: [
            {
                id: productNumericId,
                title: product.title || `프로젝트 ${productId}`,
                coverImageUrl: product.coverImageUrl,
            },
        ],
        episodes: [
            {
                id: episodeNumericId,
                productId: toNumericId(episode.productId, productNumericId),
                episodeNumber: toEpisodeNumber(episode.episodeNumber, episodeId),
                title: episode.title || `에피소드 ${episodeId}`,
                subTitle: episode.subTitle,
            },
        ],
        characters: characters.map((character) => ({
            id: toNumericId(character.id),
            name: character.name,
            color: getCharacterColor(toNumericId(character.id)),
        })),
        scripts: recordingCueEntries.map(({ track, cue }, index) => ({
            id: toNumericId(cue.id),
            episodeId: episodeNumericId,
            characterId: resolveCueCharacterId(track, cue) ?? 0,
            text: cue.script,
            sortOrder: index + 1,
        })),
        tracks:
            tracks.length > 0
                ? tracks.map((track, index) => toDraftTrack(track, index, episodeNumericId))
                : manifest.tracks.map((track) => ({ ...track, episodeId: episodeNumericId })),
        items: manifest.items,
        media: manifest.media.map((media) => ({
            ...media,
            episodeId: episodeNumericId,
        })),
        cues: recordingCueEntries.map(({ track, cue }) => {
            const cueId = toNumericId(cue.id);
            const manifestCue = manifestCuesById.get(cueId);

            return {
                id: cueId,
                episodeId: episodeNumericId,
                scriptId: cueId,
                characterId: resolveCueCharacterId(track, cue) ?? 0,
                trackId: toNumericId(cue.trackId, toNumericId(track.id)),
                audioId: toOptionalNumericId(cue.audioId ?? manifestCue?.audioId),
                startCanvasMediaId: toOptionalNumericId(cue.startCanvasMediaId ?? manifestCue?.startCanvasMediaId),
                endCanvasMediaId: toOptionalNumericId(cue.endCanvasMediaId ?? manifestCue?.endCanvasMediaId),
                startTime: cue.startTime,
                endTime: cue.endTime,
                audioStartTime: cue.audioStartTime ?? manifestCue?.audioStartTime,
                audioEndTime: cue.audioEndTime ?? manifestCue?.audioEndTime,
                startPosition: cue.startPosition ?? manifestCue?.startPosition,
                endPosition: cue.endPosition ?? manifestCue?.endPosition,
                ttsUrl: manifestCue?.ttsUrl,
                volume: cue.volume ?? manifestCue?.volume ?? 1,
            };
        }),
        records: manifest.records,
        screenEffects: [],
    };
}

function createEmptyPlayerDraft({ productId, episodeId }: PlayerDraftParams): PlayerDraft {
    const productNumericId = toNumericId(productId);
    const episodeNumericId = toNumericId(episodeId);

    return {
        products: [
            {
                id: productNumericId,
                title: `프로젝트 ${productId}`,
            },
        ],
        episodes: [
            {
                id: episodeNumericId,
                productId: productNumericId,
                episodeNumber: toEpisodeNumber(undefined, episodeId),
                title: `에피소드 ${episodeId}`,
            },
        ],
        characters: [],
        scripts: [],
        tracks: [],
        items: [],
        media: [],
        cues: [],
        records: [],
        screenEffects: [],
    };
}

function toDraftTrack(track: TrackListItem, index: number, episodeId: number): PlayerDraft['tracks'][number] {
    return {
        id: toNumericId(track.id),
        episodeId: toNumericId(track.episodeId, episodeId),
        name: track.name,
        kind: track.type,
        layerId: index,
        isMuted: track.isMuted,
    };
}

function resolveCueCharacterId(track: TrackListItem, cue: TrackCueListItem): number | undefined {
    return toOptionalNumericId(cue.characterId ?? track.characterId);
}

function toEpisodeNumber(value: number | undefined, episodeId: string): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    const parsedEpisodeId = Number.parseInt(episodeId, 10);
    return Number.isFinite(parsedEpisodeId) ? parsedEpisodeId : 0;
}

function getCharacterColor(characterId: number): string {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#64748b'];
    return colors[Math.abs(characterId) % colors.length];
}

function toNumericId(value: number | string | null | undefined, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function toOptionalNumericId(value: number | string | null | undefined): number | undefined {
    const id = toNumericId(value, Number.NaN);
    return Number.isFinite(id) ? id : undefined;
}
