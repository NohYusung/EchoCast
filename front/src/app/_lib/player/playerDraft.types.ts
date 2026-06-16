import type { PlayerItemKind, PlayerTrackKind } from './playerManifest.types';

export interface PlayerDraft {
    products: Array<{
        id: number;
        title: string;
        coverImageUrl?: string;
    }>;
    episodes: Array<{
        id: number;
        productId: number;
        episodeNumber: number;
        title: string;
        subTitle?: string;
    }>;
    characters: Array<{
        id: number;
        name: string;
        color: string;
        defaultTtsVoiceId?: number;
    }>;
    scripts: Array<{
        id: number;
        episodeId: number;
        characterId: number;
        text: string;
        sortOrder: number;
    }>;
    tracks: Array<{
        id: number;
        episodeId: number;
        name: string;
        kind: PlayerTrackKind;
        layerId: number;
        isMuted: boolean;
    }>;
    items: Array<{
        id: number;
        trackId: number;
        kind: PlayerItemKind;
        startTime: number;
        endTime: number;
        mediaId?: number;
        cueId?: number;
        layerId: number;
        trimStartTime?: number;
        trimEndTime?: number;
        hasTimelineControls?: boolean;
        isMuted?: boolean;
        volume?: number;
    }>;
    media: Array<{
        id: number;
        episodeId: number;
        kind: 'image' | 'video' | 'audio' | 'effect';
        url: string;
        naturalWidth?: number;
        naturalHeight?: number;
        durationMs?: number;
    }>;
    ttsVoices: Array<{
        id: number;
        provider: string;
        voiceName: string;
        languageCode: string;
    }>;
    cues: Array<{
        id: number;
        episodeId: number;
        scriptId: number;
        characterId: number;
        trackId: number;
        audioId?: number;
        startCanvasMediaId?: number;
        endCanvasMediaId?: number;
        startTime: number;
        endTime: number;
        audioStartTime?: number;
        audioEndTime?: number;
        startPosition?: number;
        endPosition?: number;
        ttsVoiceId?: number;
        ttsUrl?: string;
        volume: number;
    }>;
    records: Array<{
        id: number;
        cueId: number;
        artistId: number | null;
        recordUrl: string;
        duration?: number;
        volume: number;
        isAccepted: boolean;
    }>;
    screenEffects?: Array<{
        type: 'effect';
        uuid: string;
        time_ms: number;
        params: Record<string, unknown>;
    }>;
}
