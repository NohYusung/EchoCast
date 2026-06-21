import type { PlayerItemKind, PlayerTrackKind } from './playerManifest.types';

// PlayerDraft는 백엔드 PlayerService draft/manifest와 프론트 녹음실/export 로직 사이의 경계 타입이다.
// 필드 삭제나 이름 변경은 getPlayerDraft, recordingStudio, vogopangContent, sampleDraft 소비 경로를 같이 확인한다.
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
        imageUrl?: string;
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
        trackId?: number;
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
        // 보이스 큐의 주 계약은 record/audio 기반이며 ttsVoiceId/ttsUrl은 레거시 fallback이다.
        // production API에서 다시 살릴 때는 Cue 엔티티/DTO/PlayerService 계약을 먼저 맞춘다.
        ttsVoiceId?: number;
        ttsUrl?: string;
        volume: number;
    }>;
    records: Array<{
        id: number;
        cueId: number;
        artistId: number | null;
        audioId: number;
        recordUrl?: string;
        duration?: number;
        isAccepted: boolean;
    }>;
    // screenEffects는 현재 getPlayerDraft에서 빈 배열로만 생성되고 Vogopang export에서만 읽는다.
    // 실제 백엔드 screen effect 도메인이 생기기 전까지 persistent draft 계약으로 확장하지 않는다.
    screenEffects?: Array<{
        type: 'effect';
        uuid: string;
        time_ms: number;
        params: Record<string, unknown>;
    }>;
}
