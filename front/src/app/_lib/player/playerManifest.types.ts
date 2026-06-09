export type TimelineItemKind = 'visual' | 'audio' | 'effect' | 'cue';

export interface TimelineItemManifest {
    id: string;
    trackId: string;
    kind: TimelineItemKind;
    startTime: number;
    endTime: number;
    mediaId?: string;
    cueId?: string;
    layerId: number;
    trimStartTime?: number;
    trimEndTime?: number;
    volume: number;
}

export interface CueManifest {
    id: string;
    scriptId: string;
    characterId: string;
    trackId: string;
    startTime: number;
    endTime: number;
    approvedRecordUrl?: string;
    ttsUrl?: string;
    volume: number;
}

export interface RecordManifest {
    id: string;
    cueId: string;
    artistId: string;
    status: 'draft' | 'approved' | 'rejected';
    audioUrl: string;
    durationMs: number;
    volume: number;
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
    tracks: Array<{
        id: string;
        name: string;
        kind: 'visual' | 'dialogue' | 'audio' | 'effect';
        layerId: number;
        isMuted: boolean;
    }>;
    items: TimelineItemManifest[];
    cues: CueManifest[];
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
