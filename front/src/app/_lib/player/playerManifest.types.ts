import type { CanvasVisualClipItem } from './visualClips';

export type PlayerItemKind = 'visual' | 'audio' | 'effect' | 'cue';

export interface PlayerManifestItem {
    id: string;
    trackId: string;
    kind: PlayerItemKind;
    startTime: number;
    endTime: number;
    canvasId?: string | number;
    index?: number;
    mediaId?: string;
    cueId?: string;
    layerId: number;
    trimStartTime?: number;
    trimEndTime?: number;
    hasTimelineControls?: boolean;
    isMuted?: boolean;
    volume: number;
}

export interface PlayerManifestScroll {
    id: string;
    trackId: string;
    canvasId?: string | number;
    startIndex: number;
    endIndex: number;
    startTime: number;
    endTime: number;
    startPosition: number;
    endPosition: number;
}

export interface PlayerManifestAnchor {
    id: string;
    trackId: string;
    canvasId: string | number;
    time: number;
    position: number;
    index: number;
}

export interface CueManifest {
    id: string;
    scriptId: string;
    characterId?: string;
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
    approvedRecordUrl?: string;
    ttsUrl?: string;
    volume: number;
}

export interface RecordManifest {
    id: string;
    cueId: string;
    artistId: string | null;
    recordUrl: string;
    duration?: number;
    volume: number;
    isAccepted: boolean;
}

export interface TtsManifest {
    id: string;
    cueId: string;
    voiceId: string;
    provider: string;
    voiceName: string;
    audioUrl: string;
}

export interface PlayerManifest {
    episodeId: string;
    durationMs: number;
    previewCanvasId?: number;
    tracks: Array<{
        id: string;
        name: string;
        kind: 'visual' | 'dialogue' | 'audio' | 'effect';
        layerId: number;
        isMuted: boolean;
    }>;
    items: PlayerManifestItem[];
    scrolls?: PlayerManifestScroll[];
    anchors?: PlayerManifestAnchor[];
    cues: CueManifest[];
    canvases?: Array<CanvasVisualClipItem & { episodeId: number }>;
    media: Array<{
        id: string;
        kind: 'image' | 'video' | 'audio' | 'effect';
        url: string;
        naturalWidth?: number;
        naturalHeight?: number;
        durationMs?: number;
    }>;
    records: RecordManifest[];
    tts: TtsManifest[];
}
