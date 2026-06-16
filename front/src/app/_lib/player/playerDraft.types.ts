import type { PlayerItemKind } from './playerManifest.types';

export interface PlayerDraft {
    products: Array<{
        id: string;
        title: string;
        coverImageUrl?: string;
    }>;
    episodes: Array<{
        id: string;
        productId: string;
        episodeNumber: number;
        title: string;
        subTitle?: string;
    }>;
    characters: Array<{
        id: string;
        name: string;
        color: string;
        defaultTtsVoiceId?: string;
    }>;
    scripts: Array<{
        id: string;
        episodeId: string;
        characterId: string;
        text: string;
        sortOrder: number;
    }>;
    tracks: Array<{
        id: string;
        episodeId: string;
        name: string;
        kind: 'visual' | 'dialogue' | 'audio' | 'effect';
        layerId: number;
        isMuted: boolean;
    }>;
    items: Array<{
        id: string;
        trackId: string;
        kind: PlayerItemKind;
        startTime: number;
        endTime: number;
        mediaId?: string;
        cueId?: string;
        layerId: number;
        trimStartTime?: number;
        trimEndTime?: number;
        hasTimelineControls?: boolean;
        isMuted?: boolean;
        volume?: number;
    }>;
    media: Array<{
        id: string;
        episodeId: string;
        kind: 'image' | 'video' | 'audio' | 'effect';
        url: string;
        naturalWidth?: number;
        naturalHeight?: number;
        durationMs?: number;
    }>;
    ttsVoices: Array<{
        id: string;
        provider: string;
        voiceName: string;
        languageCode: string;
    }>;
    cues: Array<{
        id: string;
        episodeId: string;
        scriptId: string;
        characterId: string;
        trackId: string;
        audioId?: string;
        startCanvasMediaId?: string;
        endCanvasMediaId?: string;
        startTime: number;
        endTime: number;
        audioStartTime?: number;
        audioEndTime?: number;
        startPosition?: number;
        endPosition?: number;
        ttsVoiceId?: string;
        ttsUrl?: string;
        volume: number;
    }>;
    records: Array<{
        id: string;
        cueId: string;
        artistId: string | null;
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
