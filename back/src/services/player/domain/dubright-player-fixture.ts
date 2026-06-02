import type { PlaybackMediaKind } from './playback-manifest';

export type DubrightPlayerMediaFixture = {
    id: string;
    kind: PlaybackMediaKind;
    src: string;
    poster?: string;
    width: number;
    height: number;
};

export type DubrightPlayerCueFixture = {
    id: string;
    offsetMs: number;
    durationMs: number;
    label: string;
    viewport: {
        x: number;
        y: number;
        scale: number;
    };
};

export type DubrightPlayerTimelineFixture = {
    id: string;
    mediaId: string;
    durationMs: number;
    cues: DubrightPlayerCueFixture[];
};

export type DubrightPlayerFixture = {
    id: string;
    title: string;
    media: DubrightPlayerMediaFixture[];
    timeline: DubrightPlayerTimelineFixture[];
};

export const SAMPLE_DUBRIGHT_PLAYER_FIXTURE: DubrightPlayerFixture = {
    id: 'sample-player',
    title: 'Sample image and video player',
    media: [
        {
            id: 'media-opening-image',
            kind: 'image',
            src: '/images/player/sample-image.svg',
            width: 1280,
            height: 720,
        },
        {
            id: 'media-motion-video',
            kind: 'video',
            src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            poster: '/images/player/sample-video-poster.svg',
            width: 1280,
            height: 720,
        },
    ],
    timeline: [
        {
            id: 'scene-001',
            mediaId: 'media-opening-image',
            durationMs: 7000,
            cues: [
                {
                    id: 'cue-001',
                    offsetMs: 0,
                    durationMs: 3500,
                    label: 'establish',
                    viewport: { x: 0, y: 0, scale: 1 },
                },
                {
                    id: 'cue-002',
                    offsetMs: 3500,
                    durationMs: 3500,
                    label: 'focus',
                    viewport: { x: 18, y: 10, scale: 1.18 },
                },
            ],
        },
        {
            id: 'scene-002',
            mediaId: 'media-motion-video',
            durationMs: 8500,
            cues: [
                {
                    id: 'cue-003',
                    offsetMs: 0,
                    durationMs: 4000,
                    label: 'motion',
                    viewport: { x: 0, y: 0, scale: 1 },
                },
                {
                    id: 'cue-004',
                    offsetMs: 4000,
                    durationMs: 4500,
                    label: 'close',
                    viewport: { x: 12, y: 8, scale: 1.12 },
                },
            ],
        },
        {
            id: 'scene-003',
            mediaId: 'media-opening-image',
            durationMs: 6500,
            cues: [
                {
                    id: 'cue-005',
                    offsetMs: 0,
                    durationMs: 6500,
                    label: 'resolve',
                    viewport: { x: 0, y: 0, scale: 1 },
                },
            ],
        },
    ],
};
