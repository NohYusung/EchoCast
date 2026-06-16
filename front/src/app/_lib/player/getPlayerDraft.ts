import type { PlayerDraft } from './playerDraft.types';
import type { PlayerManifest } from './playerManifest.types';

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
};

type CharacterListItem = {
    id: number | string;
    name: string;
};

type TrackApiType = 'scroll' | 'scrolls' | 'record' | 'audio' | 'effect' | 'bgm';

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
};

export async function getPlayerDraft({ productId, episodeId }: PlayerDraftParams): Promise<PlayerDraft> {
    const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4100').replace(/\/$/, '');
    const fallbackDraft = createEmptyPlayerDraft({ productId, episodeId });

    try {
        const [product, episode, characters, tracks, manifest] = await Promise.all([
            retrieveApiData<ProductRetrieveItem>(`${apiBaseUrl}/products/${productId}`),
            retrieveApiData<EpisodeRetrieveItem>(`${apiBaseUrl}/products/${productId}/episodes/${episodeId}`),
            listApiItems<CharacterListItem>(`${apiBaseUrl}/products/${productId}/characters`),
            listApiItems<TrackListItem>(`${apiBaseUrl}/episodes/${episodeId}/tracks`),
            retrieveApiData<PlayerManifest>(`${apiBaseUrl}/player/manifest/${episodeId}`),
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
        .filter(({ track, cue }) => resolveCueCharacterId(track, cue) !== '')
        .sort((left, right) => left.cue.startTime - right.cue.startTime || toId(left.cue.id).localeCompare(toId(right.cue.id)));
    const manifestCuesById = new Map(manifest.cues.map((cue) => [cue.id, cue]));

    return {
        products: [
            {
                id: toId(product.id, productId),
                title: product.title || `프로젝트 ${productId}`,
                coverImageUrl: product.coverImageUrl,
            },
        ],
        episodes: [
            {
                id: toId(episode.id, episodeId),
                productId: toId(episode.productId, productId),
                episodeNumber: toEpisodeNumber(episode.episodeNumber, episodeId),
                title: episode.title || `에피소드 ${episodeId}`,
                subTitle: episode.subTitle,
            },
        ],
        characters: characters.map((character) => ({
            id: toId(character.id),
            name: character.name,
            color: getCharacterColor(toId(character.id)),
        })),
        scripts: recordingCueEntries.map(({ track, cue }, index) => ({
            id: toScriptId(cue.id),
            episodeId,
            characterId: resolveCueCharacterId(track, cue),
            text: cue.script,
            sortOrder: index + 1,
        })),
        tracks: tracks.length > 0 ? tracks.map((track, index) => toDraftTrack(track, index, episodeId)) : manifest.tracks.map((track) => ({ ...track, episodeId })),
        items: manifest.items,
        media: manifest.media.map((media) => ({
            ...media,
            episodeId,
        })),
        ttsVoices: toTtsVoices(manifest),
        cues: recordingCueEntries.map(({ track, cue }) => {
            const cueId = toId(cue.id);
            const manifestCue = manifestCuesById.get(cueId);

            return {
                id: cueId,
                episodeId,
                scriptId: toScriptId(cue.id),
                characterId: resolveCueCharacterId(track, cue),
                trackId: toId(cue.trackId, toId(track.id)),
                audioId: toOptionalId(cue.audioId ?? manifestCue?.audioId),
                startCanvasMediaId: toOptionalId(cue.startCanvasMediaId ?? manifestCue?.startCanvasMediaId),
                endCanvasMediaId: toOptionalId(cue.endCanvasMediaId ?? manifestCue?.endCanvasMediaId),
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
    return {
        products: [
            {
                id: productId,
                title: `프로젝트 ${productId}`,
            },
        ],
        episodes: [
            {
                id: episodeId,
                productId,
                episodeNumber: toEpisodeNumber(undefined, episodeId),
                title: `에피소드 ${episodeId}`,
            },
        ],
        characters: [],
        scripts: [],
        tracks: [],
        items: [],
        media: [],
        ttsVoices: [],
        cues: [],
        records: [],
        screenEffects: [],
    };
}

function toDraftTrack(track: TrackListItem, index: number, episodeId: string): PlayerDraft['tracks'][number] {
    return {
        id: toId(track.id),
        episodeId: toId(track.episodeId, episodeId),
        name: track.name,
        kind: toDraftTrackKind(track.type),
        layerId: index,
        isMuted: track.isMuted,
    };
}

function toDraftTrackKind(type: TrackApiType): PlayerDraft['tracks'][number]['kind'] {
    if (type === 'record') return 'dialogue';
    if (type === 'effect') return 'effect';
    if (type === 'audio' || type === 'bgm') return 'audio';
    return 'visual';
}

function toTtsVoices(manifest: PlayerManifest): PlayerDraft['ttsVoices'] {
    const voiceById = new Map<string, PlayerDraft['ttsVoices'][number]>();

    for (const tts of manifest.tts) {
        if (!voiceById.has(tts.voiceId)) {
            voiceById.set(tts.voiceId, {
                id: tts.voiceId,
                provider: tts.provider,
                voiceName: tts.voiceName,
                languageCode: 'ko-KR',
            });
        }
    }

    return [...voiceById.values()];
}

function resolveCueCharacterId(track: TrackListItem, cue: TrackCueListItem): string {
    return toId(cue.characterId ?? track.characterId ?? '');
}

function toScriptId(cueId: number | string): string {
    return `cue-${toId(cueId)}`;
}

function toEpisodeNumber(value: number | undefined, episodeId: string): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    const parsedEpisodeId = Number.parseInt(episodeId, 10);
    return Number.isFinite(parsedEpisodeId) ? parsedEpisodeId : 0;
}

function getCharacterColor(characterId: string): string {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#64748b'];
    const seed = Array.from(characterId).reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
    return colors[seed % colors.length];
}

function toId(value: number | string | null | undefined, fallback = ''): string {
    if (value === null || typeof value === 'undefined') return fallback;
    return String(value);
}

function toOptionalId(value: number | string | null | undefined): string | undefined {
    const id = toId(value);
    return id || undefined;
}
