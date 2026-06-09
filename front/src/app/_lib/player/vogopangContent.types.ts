export interface VogopangContentImage {
    uuid: string;
    realname: string;
    order: number;
    src: string;
    url?: string;
}

export interface VogopangContentSpoint {
    uuid: string;
    top: number;
    time_ms: number;
    transition_effect: {
        before_ms: number;
        after_ms: number;
    };
}

export interface VogopangContentRecord {
    src: string;
    artist_no: number;
    margin?: number;
}

export interface VogopangContentHole {
    uuid: string;
    script_uuid: string;
    start_ms: number;
    duration_ms: number;
    tts_uuid?: string;
    script: string;
    index: number;
    records: VogopangContentRecord[];
}

export interface VogopangContentTrack {
    character_uuid: string;
    character_name: string;
    holes: VogopangContentHole[];
}

export interface VogopangContentAudioClip {
    src?: string;
    url?: string;
    rawSrc?: string;
    start_ms?: number;
    duration_ms?: number;
    trim_left_ms?: number;
    trim_right_ms?: number;
}

export interface VogopangContentAudioTrack {
    uuid: string;
    name: string;
    graph: unknown[];
    clips: VogopangContentAudioClip[];
}

export interface VogopangContentEffect {
    type: 'effect';
    uuid: string;
    time_ms: number;
    params: Record<string, unknown>;
}

export interface VogopangContent {
    images: VogopangContentImage[];
    replace_images: unknown[];
    format_version: string;
    spoints: VogopangContentSpoint[];
    tracks: VogopangContentTrack[];
    audio_tracks: VogopangContentAudioTrack[];
    effects?: VogopangContentEffect[];
}
