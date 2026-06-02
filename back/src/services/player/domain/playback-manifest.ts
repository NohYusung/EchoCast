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

export const SAMPLE_PLAYBACK_MANIFEST: PlaybackManifest = {
    id: 'sample-player',
    title: 'Sample image and video player',
    variant: 'image-video',
    durationMs: 22000,
    scenes: [
        {
            id: 'scene-001',
            order: 1,
            startMs: 0,
            endMs: 7000,
            media: {
                kind: 'image',
                src: '/images/player/sample-image.svg',
                width: 1280,
                height: 720,
            },
            cues: [
                {
                    id: 'cue-001',
                    startMs: 0,
                    endMs: 3500,
                    label: 'establish',
                    viewport: { x: 0, y: 0, scale: 1 },
                },
                {
                    id: 'cue-002',
                    startMs: 3500,
                    endMs: 7000,
                    label: 'focus',
                    viewport: { x: 18, y: 10, scale: 1.18 },
                },
            ],
        },
        {
            id: 'scene-002',
            order: 2,
            startMs: 7000,
            endMs: 15500,
            media: {
                kind: 'video',
                src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
                poster: '/images/player/sample-video-poster.svg',
                width: 1280,
                height: 720,
            },
            cues: [
                {
                    id: 'cue-003',
                    startMs: 7000,
                    endMs: 11000,
                    label: 'motion',
                    viewport: { x: 0, y: 0, scale: 1 },
                },
                {
                    id: 'cue-004',
                    startMs: 11000,
                    endMs: 15500,
                    label: 'close',
                    viewport: { x: 12, y: 8, scale: 1.12 },
                },
            ],
        },
        {
            id: 'scene-003',
            order: 3,
            startMs: 15500,
            endMs: 22000,
            media: {
                kind: 'image',
                src: '/images/player/sample-image.svg',
                width: 1280,
                height: 720,
            },
            cues: [
                {
                    id: 'cue-005',
                    startMs: 15500,
                    endMs: 22000,
                    label: 'resolve',
                    viewport: { x: 0, y: 0, scale: 1 },
                },
            ],
        },
    ],
};

