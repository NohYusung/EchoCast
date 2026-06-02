export const PLAYER_MANIFEST_VARIANTS = ['image-video', 'image-only'] as const;

export type PlayerManifestVariant = (typeof PLAYER_MANIFEST_VARIANTS)[number];

export type PlaybackMediaKind = 'image' | 'video';

export type PlaybackMedia = {
    kind: PlaybackMediaKind;
    src: string;
    poster?: string;
    width: number;
    height: number;
};

export type PlaybackCue = {
    id: string;
    startMs: number;
    endMs: number;
    label: string;
    viewport: {
        x: number;
        y: number;
        scale: number;
    };
};

export type PlaybackScene = {
    id: string;
    order: number;
    startMs: number;
    endMs: number;
    media: PlaybackMedia;
    cues: PlaybackCue[];
};

export type PlaybackManifest = {
    id: string;
    title: string;
    variant: PlayerManifestVariant;
    durationMs: number;
    scenes: PlaybackScene[];
};
