import type { CanvasVisualClipItem } from './visualClips';

export type PlayerItemKind = 'visual' | 'audio' | 'effect' | 'cue';
export type PlayerTrackKind = 'scroll' | 'scrolls' | 'record' | 'audio' | 'effect' | 'bgm';

export interface PlayerManifestItem {
    id: number;
    trackId?: number;
    kind: PlayerItemKind;
    startTime: number;
    endTime: number;
    canvasId?: number;
    index?: number;
    mediaId?: number;
    cueId?: number;
    layerId: number;
    trimStartTime?: number;
    trimEndTime?: number;
    hasTimelineControls?: boolean;
    isMuted?: boolean;
    volume: number;
}

export interface PlayerManifestScroll {
    id: number;
    trackId: number;
    canvasId?: number;
    startIndex: number;
    endIndex: number;
    startTime: number;
    endTime: number;
    startPosition: number;
    endPosition: number;
}

export interface PlayerManifestAnchor {
    id: number;
    trackId: number;
    canvasId: number;
    time: number;
    position: number;
    index: number;
}

export interface CueManifest {
    id: number;
    scriptId: number;
    characterId?: number;
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
    approvedRecordUrl?: string;
    ttsUrl?: string;
    volume: number;
}

export interface ScriptManifest {
    id: number;
    episodeId: number;
    characterId?: number;
    text: string;
    durationMs?: number;
    sortOrder: number;
}

export interface RecordManifest {
    id: number;
    cueId: number;
    artistId: number | null;
    audioId: number;
    recordUrl?: string;
    duration?: number;
    isAccepted: boolean;
}

export interface TtsManifest {
    id: number;
    cueId: number;
    voiceId: number;
    provider: string;
    voiceName: string;
    audioUrl: string;
}

export interface PlayerManifest {
    episodeId: number;
    totalDuration: number;
    previewCanvasId?: number;
    tracks: Array<{
        id: number;
        name: string;
        kind: PlayerTrackKind;
        layerId: number;
        isMuted: boolean;
    }>;
    items: PlayerManifestItem[];
    scrolls?: PlayerManifestScroll[];
    anchors?: PlayerManifestAnchor[];
    cues: CueManifest[];
    canvases?: Array<CanvasVisualClipItem & { episodeId: number }>;
    media: Array<{
        id: number;
        kind: 'image' | 'video' | 'audio' | 'effect';
        url: string;
        naturalWidth?: number;
        naturalHeight?: number;
        durationMs?: number;
    }>;
    scripts?: ScriptManifest[];
    records: RecordManifest[];
    tts: TtsManifest[];
}
