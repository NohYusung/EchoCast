'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { PlayerDraft } from './playerDraft.types';
import type { PlayerManifest } from './playerManifest.types';

const TIMELINE_DURATION_SECONDS = 72;
const TIMELINE_TRACK_HEIGHT = 58;
const VISUAL_TRACK_HEIGHT = 64;
const PREVIEW_CUT_HEIGHT = 198;
const PREVIEW_VIEWPORT_HEIGHT = 540;
const PREVIEW_SCROLL_STRIP_HEIGHT_PX = 2400;
const INITIAL_PLAYHEAD_SECONDS = 18.4;
const MIN_PX_PER_SECOND = 10;
const MAX_PX_PER_SECOND = 24;
const MIN_PREVIEW_ZOOM = 0.75;
const MAX_PREVIEW_ZOOM = 1.55;
const PREVIEW_ZOOM_STEP = 0.05;
const DEFAULT_TIMELINE_PANEL_HEIGHT = 336;
const MIN_TIMELINE_PANEL_HEIGHT = 220;
const MAX_TIMELINE_PANEL_HEIGHT = 620;
const MIN_TIMELINE_ITEM_DURATION_SECONDS = 0.5;
const TIMELINE_RESIZE_EXTENSION_SECONDS = 24;
const TIMELINE_SNAP_SECONDS = 0.5;
const PREVIEW_SCROLL_EDITABLE_RATIO = 0.82;

type PanelId = 'fx' | 'char' | 'assets' | 'audio' | 'text' | 'settings';
type CharacterId = 'jihu' | 'seora' | 'teacher';
type AudioTrackId = string;
type TrackApiType = 'scroll' | 'record' | 'audio' | 'effect' | 'bgm';
type EffectId = 'fadeIn' | 'fadeOut' | 'zoom' | 'shake' | 'spark';
type IconName =
    | 'asset'
    | 'bolt'
    | 'caption'
    | 'cursor'
    | 'download'
    | 'effect'
    | 'fadeIn'
    | 'fadeOut'
    | 'fullscreen'
    | 'image'
    | 'lock'
    | 'mic'
    | 'minus'
    | 'move'
    | 'music'
    | 'pause'
    | 'play'
    | 'plus'
    | 'quote'
    | 'search'
    | 'settings'
    | 'speaker'
    | 'text'
    | 'wave';

type PanelDefinition = {
    id: PanelId;
    label: string;
    icon: IconName;
    title: string;
    description: string;
};

type CharacterDefinition = {
    id: CharacterId;
    name: string;
    role: string;
    color: string;
    initial: string;
    voice: string;
};

type EffectDefinition = {
    id: EffectId;
    name: string;
    description: string;
    icon: IconName;
    preset: string;
};

type AudioTrackDefinition = {
    id: AudioTrackId;
    label: string;
    sublabel: string;
    icon: IconName;
    kind?: TrackApiType;
    color?: string;
};

type TimelineClip = {
    id: string;
    track: AudioTrackId;
    start: number;
    duration: number;
    label: string;
    sublabel: string;
    characterId?: CharacterId;
    effects?: EffectId[];
};

type ScrollEventClip = TimelineClip & {
    track: 'visual';
    previewStartPx: number;
    previewEndPx: number;
};

type VisualClip = {
    id: string;
    kind: 'cut' | 'video';
    start: number;
    duration: number;
    label: string;
    description: string;
    background: string;
    effects?: EffectId[];
    bubble?: {
        text: string;
        tone?: 'default' | 'right' | 'narration';
    };
    subtitle?: string;
};

type Selection = TimelineClip | VisualClip;
type TimelineItemKind = 'scroll' | 'audio';
type TimelineEditMode = 'move' | 'resize-start' | 'resize-end';
type TimelineEditableItem = Pick<TimelineClip | VisualClip, 'id' | 'start' | 'duration'>;
type TimelinePointerEdit = {
    itemId: string;
    itemKind: TimelineItemKind;
    mode: TimelineEditMode;
    pointerStartX: number;
    originalStart: number;
    originalDuration: number;
};
type TimelinePointerEditRequest = {
    event: ReactPointerEvent<HTMLElement>;
    itemKind: TimelineItemKind;
    item: TimelineEditableItem;
    mode: TimelineEditMode;
};
type TimelinePointerEditHandlers = {
    draggingItemId: string | null;
    onTimelinePointerEditStart: (request: TimelinePointerEditRequest) => void;
    onTimelinePointerEditMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onTimelinePointerEditEnd: (event: ReactPointerEvent<HTMLElement>) => void;
};
type TimelinePanelResize = {
    pointerStartY: number;
    originalHeight: number;
};
type TimelinePanelResizeHandlers = {
    timelineHeight: number;
    isTimelineHeightResizing: boolean;
    onTimelineHeightResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
    onTimelineHeightResizeMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onTimelineHeightResizeEnd: (event: ReactPointerEvent<HTMLElement>) => void;
};
type PreviewScrollEditMode = 'move' | 'resize-start' | 'resize-end';
type PreviewScrollPointerEdit = {
    eventId: string;
    mode: PreviewScrollEditMode;
    pointerStartY: number;
    overlayHeightPx: number;
    originalStartPx: number;
    originalEndPx: number;
};
type PreviewScrollPointerEditRequest = {
    event: ReactPointerEvent<HTMLElement>;
    item: ScrollEventClip;
    mode: PreviewScrollEditMode;
};
type PreviewScrollPointerEditHandlers = {
    previewScrollEditingId: string | null;
    onPreviewScrollEditStart: (request: PreviewScrollPointerEditRequest) => void;
    onPreviewScrollEditMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPreviewScrollEditEnd: (event: ReactPointerEvent<HTMLElement>) => void;
};
type TrackCueListItem = {
    id: number;
    scriptId: number;
    characterId: number;
    trackId: number;
    startTime: number;
    endTime: number;
    ttsVoiceId?: number;
    volume: number;
};
type TrackListItem = {
    id: number;
    episodeId: number;
    name: string;
    type: TrackApiType;
    isMuted: boolean;
    cues?: TrackCueListItem[];
};
type TrackListResponse = {
    data: {
        items: TrackListItem[];
        total: number;
    };
};
type TimelineData = {
    audioTracks: AudioTrackDefinition[];
    timelineClips: TimelineClip[];
};
type TrackFormType = Extract<TrackApiType, 'record' | 'audio' | 'bgm' | 'effect' | 'scroll'>;

const panelDefinitions: PanelDefinition[] = [
    {
        id: 'fx',
        label: '효과',
        icon: 'effect',
        title: '특수효과',
        description: '컷과 대사 클립에 바로 얹을 수 있는 연출 프리셋입니다.',
    },
    {
        id: 'char',
        label: '캐릭터',
        icon: 'mic',
        title: '캐릭터 보이스',
        description: '등장인물별 목소리, 감정톤, 대사 분량을 관리합니다.',
    },
    {
        id: 'assets',
        label: '컷',
        icon: 'image',
        title: '웹툰 컷',
        description: '세로 스크롤 컷과 삽입 영상을 타임라인에 배치합니다.',
    },
    {
        id: 'audio',
        label: '사운드',
        icon: 'music',
        title: '사운드',
        description: 'BGM, 효과음, 나레이션 소스를 한 곳에서 확인합니다.',
    },
    {
        id: 'text',
        label: '자막',
        icon: 'text',
        title: '자막 · 번역',
        description: '대사와 나레이션을 영상 자막으로 정리합니다.',
    },
    {
        id: 'settings',
        label: '설정',
        icon: 'settings',
        title: '프로젝트 설정',
        description: '영상 비율, 내보내기 품질, 작업 기준을 조정합니다.',
    },
];

const characters: CharacterDefinition[] = [
    {
        id: 'jihu',
        name: '지후',
        role: '주인공',
        color: '#65d1ff',
        initial: '지',
        voice: '차분한 10대 남성',
    },
    {
        id: 'seora',
        name: '서라',
        role: '라이벌',
        color: '#f4a0ff',
        initial: '서',
        voice: '선명한 10대 여성',
    },
    {
        id: 'teacher',
        name: '담임',
        role: '조력자',
        color: '#ffcb6b',
        initial: '담',
        voice: '낮고 안정적인 성인 남성',
    },
];

const effectLibrary: EffectDefinition[] = [
    {
        id: 'fadeIn',
        name: '페이드 인',
        description: '서서히 나타나기',
        icon: 'fadeIn',
        preset: '0.35s ease-in',
    },
    {
        id: 'fadeOut',
        name: '페이드 아웃',
        description: '서서히 사라지기',
        icon: 'fadeOut',
        preset: '0.42s ease-out',
    },
    {
        id: 'zoom',
        name: '줌 인',
        description: '컷 중심 확대',
        icon: 'fullscreen',
        preset: '112% scale',
    },
    {
        id: 'shake',
        name: '충격 흔들림',
        description: '효과음 구간 강조',
        icon: 'wave',
        preset: 'x 8px / 0.18s',
    },
    {
        id: 'spark',
        name: '빛 번짐',
        description: '감정 전환 강조',
        icon: 'bolt',
        preset: 'screen blend',
    },
];

const fallbackAudioTracks: AudioTrackDefinition[] = [
    {
        id: 'jihu',
        label: '지후',
        sublabel: 'VOICE',
        icon: 'mic',
        kind: 'record',
        color: '#65d1ff',
    },
    {
        id: 'seora',
        label: '서라',
        sublabel: 'VOICE',
        icon: 'mic',
        kind: 'record',
        color: '#f4a0ff',
    },
    {
        id: 'teacher',
        label: '담임',
        sublabel: 'VOICE',
        icon: 'mic',
        kind: 'record',
        color: '#ffcb6b',
    },
    {
        id: 'na',
        label: '나레이션',
        sublabel: 'NARRATION',
        icon: 'quote',
        kind: 'record',
    },
    {
        id: 'sub',
        label: '자막',
        sublabel: 'CAPTION',
        icon: 'caption',
        kind: 'scroll',
    },
    {
        id: 'bgm',
        label: 'BGM',
        sublabel: 'MUSIC',
        icon: 'music',
        kind: 'bgm',
    },
    {
        id: 'sfx',
        label: '효과음',
        sublabel: 'SFX',
        icon: 'wave',
        kind: 'effect',
    },
];

const fallbackVisualClips: VisualClip[] = [
    {
        id: 'c1',
        kind: 'cut',
        start: 0,
        duration: 9,
        label: '컷 01',
        description: '교실 전경',
        background: 'linear-gradient(160deg,#22304f,#111827 62%,#263c2f)',
        effects: ['fadeIn'],
        subtitle: '비가 그친 오후, 교실은 이상하게 조용했다.',
    },
    {
        id: 'c2',
        kind: 'cut',
        start: 9,
        duration: 8,
        label: '컷 02',
        description: '복도 추격',
        background: 'linear-gradient(160deg,#453456,#171421 62%,#3f2533)',
        bubble: {
            text: '방금 들었어?',
        },
    },
    {
        id: 'c3',
        kind: 'cut',
        start: 17,
        duration: 13,
        label: '컷 03',
        description: '문 너머의 빛',
        background: 'linear-gradient(160deg,#314f48,#0d1d1d 64%,#5d5430)',
        effects: ['zoom'],
        bubble: {
            text: '잠깐, 여기서 멈춰.',
            tone: 'right',
        },
        subtitle: '서라는 문틈 사이로 새어 나오는 빛을 보았다.',
    },
    {
        id: 'v1',
        kind: 'video',
        start: 30,
        duration: 11,
        label: '영상 01',
        description: '문 열림 애니메이션',
        background: 'linear-gradient(135deg,#67503a,#1a1410 60%,#423531)',
        effects: ['fadeIn', 'fadeOut'],
    },
    {
        id: 'c4',
        kind: 'cut',
        start: 41,
        duration: 10,
        label: '컷 04',
        description: '비밀 실험실',
        background: 'linear-gradient(150deg,#233d5f,#0f172a 65%,#182c3b)',
        bubble: {
            text: '이걸 선생님이 숨겼다고?',
        },
    },
    {
        id: 'c5',
        kind: 'cut',
        start: 51,
        duration: 10,
        label: '컷 05',
        description: '담임의 고백',
        background: 'linear-gradient(160deg,#583c3c,#1f1616 60%,#604b2e)',
        bubble: {
            text: '너희에게 말할 시간이 왔구나.',
            tone: 'narration',
        },
    },
    {
        id: 'c6',
        kind: 'cut',
        start: 61,
        duration: 11,
        label: '컷 06',
        description: '다음 화 연결',
        background: 'linear-gradient(160deg,#233a36,#081615 68%,#4a3a58)',
        effects: ['spark'],
        subtitle: '그리고, 책상 아래에서 낡은 녹음기가 켜졌다.',
    },
];

const fallbackTimelineClips: TimelineClip[] = [
    {
        id: 'v-jihu-1',
        track: 'jihu',
        start: 3,
        duration: 7,
        label: '무슨 소리지?',
        sublabel: 'angry 0.18',
        characterId: 'jihu',
    },
    {
        id: 'v-jihu-2',
        track: 'jihu',
        start: 18.8,
        duration: 8.2,
        label: '여기서 멈춰.',
        sublabel: 'whisper',
        characterId: 'jihu',
        effects: ['fadeIn'],
    },
    {
        id: 'v-jihu-3',
        track: 'jihu',
        start: 45,
        duration: 7,
        label: '설명해 주세요.',
        sublabel: 'tense',
        characterId: 'jihu',
    },
    {
        id: 'v-seora-1',
        track: 'seora',
        start: 11,
        duration: 6.4,
        label: '방금 들었어?',
        sublabel: 'alert',
        characterId: 'seora',
    },
    {
        id: 'v-seora-2',
        track: 'seora',
        start: 31.5,
        duration: 8.8,
        label: '문이 열리고 있어.',
        sublabel: 'breath',
        characterId: 'seora',
        effects: ['fadeOut'],
    },
    {
        id: 'v-seora-3',
        track: 'seora',
        start: 56.5,
        duration: 6.4,
        label: '녹음기?',
        sublabel: 'shock',
        characterId: 'seora',
    },
    {
        id: 'v-teacher-1',
        track: 'teacher',
        start: 48,
        duration: 9,
        label: '말할 시간이 왔구나.',
        sublabel: 'low',
        characterId: 'teacher',
    },
    {
        id: 'na-1',
        track: 'na',
        start: 0.5,
        duration: 8.3,
        label: '비가 그친 오후',
        sublabel: 'narration',
    },
    {
        id: 'na-2',
        track: 'na',
        start: 21.4,
        duration: 7.6,
        label: '문틈 사이의 빛',
        sublabel: 'narration',
    },
    {
        id: 'na-3',
        track: 'na',
        start: 64,
        duration: 6.5,
        label: '낡은 녹음기',
        sublabel: 'narration',
    },
    {
        id: 'sub-1',
        track: 'sub',
        start: 0,
        duration: 17,
        label: 'KOR · WebVTT',
        sublabel: 'auto sync',
    },
    {
        id: 'sub-2',
        track: 'sub',
        start: 18,
        duration: 24,
        label: 'KOR · WebVTT',
        sublabel: 'checked',
    },
    {
        id: 'sub-3',
        track: 'sub',
        start: 45,
        duration: 25,
        label: 'KOR · WebVTT',
        sublabel: 'needs review',
    },
    {
        id: 'bgm-1',
        track: 'bgm',
        start: 0,
        duration: 36,
        label: 'Low Mystery Pad',
        sublabel: '-18 LUFS',
        effects: ['fadeIn'],
    },
    {
        id: 'bgm-2',
        track: 'bgm',
        start: 36,
        duration: 36,
        label: 'Reveal Pulse',
        sublabel: '-16 LUFS',
        effects: ['fadeOut'],
    },
    {
        id: 'sfx-1',
        track: 'sfx',
        start: 10.4,
        duration: 2.2,
        label: 'distant knock',
        sublabel: 'SFX',
    },
    {
        id: 'sfx-2',
        track: 'sfx',
        start: 29.8,
        duration: 3.2,
        label: 'door slide',
        sublabel: 'SFX',
        effects: ['shake'],
    },
    {
        id: 'sfx-3',
        track: 'sfx',
        start: 62.5,
        duration: 4.2,
        label: 'tape click',
        sublabel: 'SFX',
        effects: ['spark'],
    },
];

const audioAssets = [
    { title: 'Low Mystery Pad', meta: 'BGM · 01:12 · -18 LUFS' },
    { title: 'Reveal Pulse', meta: 'BGM · 00:36 · crescendo' },
    { title: 'Distant Knock', meta: 'SFX · 00:02 · hallway' },
    { title: 'Door Slide', meta: 'SFX · 00:03 · metal' },
];

const subtitleRows = [
    { time: '00:00.5', text: '비가 그친 오후, 교실은 이상하게 조용했다.' },
    { time: '00:11.0', text: '방금 들었어?' },
    { time: '00:18.8', text: '잠깐, 여기서 멈춰.' },
    { time: '00:48.0', text: '너희에게 말할 시간이 왔구나.' },
];

const characterById = new Map(characters.map((character) => [character.id, character]));
const effectById = new Map(effectLibrary.map((effect) => [effect.id, effect]));
const fallbackTimelineData: TimelineData = {
    audioTracks: fallbackAudioTracks,
    timelineClips: fallbackTimelineClips,
};
const fallbackScrollEvents: ScrollEventClip[] = [
    {
        id: 'scroll-event-1',
        track: 'visual',
        start: 0,
        duration: 9,
        label: '오프닝 팬',
        sublabel: '0px -> 300px',
        previewStartPx: 0,
        previewEndPx: 300,
        effects: ['fadeIn'],
    },
    {
        id: 'scroll-event-2',
        track: 'visual',
        start: 17,
        duration: 7,
        label: '장면 전환',
        sublabel: '300px -> 884px',
        previewStartPx: 300,
        previewEndPx: 884,
    },
    {
        id: 'scroll-event-3',
        track: 'visual',
        start: 50,
        duration: 12,
        label: '엔딩 팬',
        sublabel: '1680px -> 2100px',
        previewStartPx: 1680,
        previewEndPx: 2100,
        effects: ['fadeOut'],
    },
];
const waveformBars = Array.from({ length: 24 }, (_, index) => 18 + ((index * 17) % 32));
const stripMarkers = Array.from({ length: 7 }, (_, index) => index + 1);
const trackColorPalette = ['#65d1ff', '#f4a0ff', '#ffcb6b', '#9ae6b4', '#c4b5fd', '#fca5a5', '#93c5fd'];

const iconPaths: Record<IconName, ReactNode> = {
    asset: (
        <>
            <rect height="14" rx="2" width="16" x="4" y="5" />
            <path d="m7 16 3.5-4 2.5 3 2-2.2L20 18" />
        </>
    ),
    bolt: <path d="m13 2-8 12h6l-1 8 8-12h-6z" />,
    caption: (
        <>
            <rect height="12" rx="2" width="18" x="3" y="6" />
            <path d="M7 10h5M7 14h10" />
        </>
    ),
    cursor: <path d="m4 3 8 18 2.2-7 6.8-2.4z" />,
    download: (
        <>
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
        </>
    ),
    effect: (
        <>
            <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    fadeIn: (
        <>
            <path d="M4 18c5.5 0 8-12 16-12" />
            <path d="M4 6h4M4 10h8M4 14h12" />
        </>
    ),
    fadeOut: (
        <>
            <path d="M4 6c5.5 0 8 12 16 12" />
            <path d="M4 18h4M4 14h8M4 10h12" />
        </>
    ),
    fullscreen: (
        <>
            <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
            <path d="M9 9h6v6H9z" />
        </>
    ),
    image: (
        <>
            <rect height="16" rx="2" width="18" x="3" y="4" />
            <circle cx="8" cy="9" r="1.5" />
            <path d="m21 16-5.2-5.2a2 2 0 0 0-2.8 0L5 18" />
        </>
    ),
    lock: (
        <>
            <rect height="10" rx="2" width="14" x="5" y="11" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
    ),
    mic: (
        <>
            <rect height="11" rx="4" width="8" x="8" y="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3M9 21h6" />
        </>
    ),
    minus: <path d="M5 12h14" />,
    move: (
        <>
            <path d="M12 2v20M2 12h20" />
            <path d="m8 6 4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" />
        </>
    ),
    music: (
        <>
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
        </>
    ),
    pause: (
        <>
            <path d="M8 5v14" />
            <path d="M16 5v14" />
        </>
    ),
    play: <path d="m8 5 11 7-11 7z" />,
    plus: (
        <>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
        </>
    ),
    quote: (
        <>
            <path d="M8 11H5.8C5.8 7.8 7 6 9.6 5.2" />
            <path d="M18 11h-2.2c0-3.2 1.2-5 3.8-5.8" />
            <path d="M5 11h5v6H5zM15 11h5v6h-5z" />
        </>
    ),
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </>
    ),
    settings: (
        <>
            <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7.1 4.4l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.9 7l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.7 1Z" />
        </>
    ),
    speaker: (
        <>
            <path d="M4 10v4h4l5 4V6L8 10z" />
            <path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" />
        </>
    ),
    text: (
        <>
            <path d="M4 6h16M12 6v12" />
            <path d="M8 18h8" />
        </>
    ),
    wave: (
        <>
            <path d="M3 12h3l2-6 4 12 3-9 2 3h4" />
            <path d="M4 20h16" />
        </>
    ),
};

function StudioIcon({ name, size = 18 }: { name: IconName; size?: number }) {
    return (
        <svg aria-hidden="true" className="odx-icon" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width={size}>
            {iconPaths[name]}
        </svg>
    );
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function formatTime(seconds: number) {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = Math.floor(safeSeconds % 60);
    const frames = Math.floor((safeSeconds % 1) * 24);

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

function getTrackKindLabel(kind: TrackApiType) {
    if (kind === 'scroll') return 'SCROLL';
    if (kind === 'record') return 'VOICE';
    if (kind === 'audio') return 'AUDIO';
    if (kind === 'bgm') return 'MUSIC';
    return 'SFX';
}

function getTrackKindIcon(kind: TrackApiType): IconName {
    if (kind === 'scroll') return 'image';
    if (kind === 'record') return 'mic';
    if (kind === 'audio' || kind === 'bgm') return 'music';
    return 'wave';
}

function toTimelineSeconds(time: number) {
    return time >= 1000 ? time / 1000 : time;
}

function snapTimelineSeconds(time: number) {
    return Math.round(time / TIMELINE_SNAP_SECONDS) * TIMELINE_SNAP_SECONDS;
}

function getDefaultTrackName(kind: TrackFormType) {
    if (kind === 'record') return '새 보이스 트랙';
    if (kind === 'audio') return '새 오디오 트랙';
    if (kind === 'bgm') return '새 BGM';
    if (kind === 'effect') return '새 효과음';
    return '새 스크롤 트랙';
}

function getDefaultCueLabel(kind: TrackApiType | undefined) {
    if (kind === 'bgm') return '새 BGM';
    if (kind === 'effect') return '새 효과음';
    if (kind === 'audio') return '새 오디오';
    if (kind === 'scroll') return '새 스크롤 큐';
    return '새 큐';
}

function toTimelineData(tracks: TrackListItem[]): TimelineData {
    return {
        audioTracks: tracks.map((track, index) => ({
            id: String(track.id),
            label: track.name,
            sublabel: getTrackKindLabel(track.type),
            icon: getTrackKindIcon(track.type),
            kind: track.type,
            color: track.type === 'record' ? trackColorPalette[index % trackColorPalette.length] : undefined,
        })),
        timelineClips: tracks.flatMap((track) =>
            [...(track.cues ?? [])]
                .sort((a, b) => a.startTime - b.startTime || a.id - b.id)
                .map((cue) => {
                    const start = toTimelineSeconds(cue.startTime);
                    const end = toTimelineSeconds(cue.endTime);

                    return {
                        id: `cue-${cue.id}`,
                        track: String(track.id),
                        start,
                        duration: Math.max(end - start, 0.2),
                        label: `스크립트 ${cue.scriptId}`,
                        sublabel: cue.ttsVoiceId ? `voice ${cue.ttsVoiceId} · vol ${cue.volume}` : `vol ${cue.volume}`,
                    };
                }),
        ),
    };
}

async function listTracks(apiBaseUrl: string, episodeId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/tracks`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Track list failed: ${response.status}`);
    }

    const result = (await response.json()) as TrackListResponse;
    return result.data.items;
}

function getItemEffects(item: Selection | undefined, overrides: Record<string, EffectId[]>) {
    if (!item) {
        return [];
    }

    return overrides[item.id] ?? item.effects ?? [];
}

function isTimelineClip(item: Selection): item is TimelineClip {
    return 'track' in item;
}

function isScrollEventClip(item: Selection): item is ScrollEventClip {
    return isTimelineClip(item) && item.track === 'visual' && 'previewStartPx' in item && 'previewEndPx' in item;
}

function getItemTypeLabel(item: Selection | undefined, trackById: Map<string, AudioTrackDefinition>) {
    if (!item) {
        return '선택 없음';
    }

    if (isTimelineClip(item)) {
        if (item.track === 'visual') {
            return 'SCROLL';
        }

        const track = trackById.get(item.track);
        return track?.sublabel ?? 'AUDIO';
    }

    return item.kind === 'video' ? 'VIDEO' : 'CUT';
}

function getSelectedItem(
    selectedId: string,
    visualClipById: Map<string, VisualClip>,
    audioClipById: Map<string, TimelineClip>,
    scrollEventById: Map<string, ScrollEventClip>,
) {
    return visualClipById.get(selectedId) ?? audioClipById.get(selectedId) ?? scrollEventById.get(selectedId);
}

function getClipStyle(start: number, duration: number, pxPerSecond: number): CSSProperties {
    return {
        left: `${start * pxPerSecond}px`,
        width: `${duration * pxPerSecond}px`,
    };
}

function getTrackBackground(track: AudioTrackDefinition) {
    if (track.color) {
        return `linear-gradient(135deg, ${track.color}36, ${track.color}14)`;
    }

    if (track.kind === 'bgm' || track.id === 'bgm') {
        return 'linear-gradient(135deg, rgba(103,232,249,.24), rgba(59,130,246,.12))';
    }

    if (track.kind === 'effect' || track.id === 'sfx') {
        return 'linear-gradient(135deg, rgba(251,113,133,.24), rgba(249,115,22,.12))';
    }

    return 'linear-gradient(135deg, rgba(148,163,184,.20), rgba(71,85,105,.12))';
}

function getPreviewTransform(playhead: number, visualClips: VisualClip[]) {
    const activeIndex = visualClips.findIndex((clip) => playhead >= clip.start && playhead < clip.start + clip.duration);
    const targetIndex = Math.max(activeIndex, 0);
    const maxOffset = Math.max(0, visualClips.length * PREVIEW_CUT_HEIGHT - PREVIEW_VIEWPORT_HEIGHT);

    return `translateY(-${clamp(targetIndex * PREVIEW_CUT_HEIGHT, 0, maxOffset)}px)`;
}

function getPreviewScrollPointTop(pixel: number) {
    return clamp((pixel / PREVIEW_SCROLL_STRIP_HEIGHT_PX) * 82 + 7, 7, 89);
}

function getPreviewScrollEventStyle(event: ScrollEventClip): CSSProperties {
    const startPx = clamp(Math.min(event.previewStartPx, event.previewEndPx), 0, PREVIEW_SCROLL_STRIP_HEIGHT_PX);
    const endPx = clamp(Math.max(event.previewStartPx, event.previewEndPx), startPx, PREVIEW_SCROLL_STRIP_HEIGHT_PX);
    const top = getPreviewScrollPointTop(startPx);
    const height = clamp(((endPx - startPx) / PREVIEW_SCROLL_STRIP_HEIGHT_PX) * 96, 8, 30);

    return {
        top: `${top}%`,
        height: `${height}%`,
    };
}

function getPreviewScrollHandleStyle(pixel: number): CSSProperties {
    return {
        top: `${getPreviewScrollPointTop(clamp(pixel, 0, PREVIEW_SCROLL_STRIP_HEIGHT_PX))}%`,
    };
}

function formatPreviewScrollLabel(startPx: number, endPx: number) {
    return `${Math.round(startPx)}px -> ${Math.round(endPx)}px`;
}

function getPreviewOverlayHeight(target: HTMLElement) {
    const overlay = target.closest('.odx-preview-scroll-overlay');

    if (!(overlay instanceof HTMLElement)) {
        return 1;
    }

    return Math.max(1, overlay.getBoundingClientRect().height);
}

function getPreviewScrollEditPixels(edit: PreviewScrollPointerEdit, clientY: number) {
    const editableHeight = Math.max(1, edit.overlayHeightPx * PREVIEW_SCROLL_EDITABLE_RATIO);
    const deltaPx = Math.round(((clientY - edit.pointerStartY) / editableHeight) * PREVIEW_SCROLL_STRIP_HEIGHT_PX);

    if (edit.mode === 'resize-start') {
        return {
            previewStartPx: clamp(edit.originalStartPx + deltaPx, 0, PREVIEW_SCROLL_STRIP_HEIGHT_PX),
            previewEndPx: edit.originalEndPx,
        };
    }

    if (edit.mode === 'resize-end') {
        return {
            previewStartPx: edit.originalStartPx,
            previewEndPx: clamp(edit.originalEndPx + deltaPx, 0, PREVIEW_SCROLL_STRIP_HEIGHT_PX),
        };
    }

    const minPx = Math.min(edit.originalStartPx, edit.originalEndPx);
    const maxPx = Math.max(edit.originalStartPx, edit.originalEndPx);
    const clampedDeltaPx = clamp(deltaPx, -minPx, PREVIEW_SCROLL_STRIP_HEIGHT_PX - maxPx);

    return {
        previewStartPx: edit.originalStartPx + clampedDeltaPx,
        previewEndPx: edit.originalEndPx + clampedDeltaPx,
    };
}

function getTimelineEditTiming(edit: TimelinePointerEdit, clientX: number, pxPerSecond: number, durationSeconds: number) {
    const deltaSeconds = snapTimelineSeconds((clientX - edit.pointerStartX) / pxPerSecond);
    const flexibleDurationLimit = Math.max(
        durationSeconds,
        edit.originalStart + edit.originalDuration + TIMELINE_RESIZE_EXTENSION_SECONDS,
    );

    if (edit.mode === 'resize-start') {
        const originalEnd = edit.originalStart + edit.originalDuration;
        const maxStart = Math.max(0, originalEnd - MIN_TIMELINE_ITEM_DURATION_SECONDS);
        const start = snapTimelineSeconds(clamp(edit.originalStart + deltaSeconds, 0, maxStart));

        return {
            start,
            duration: Math.max(MIN_TIMELINE_ITEM_DURATION_SECONDS, snapTimelineSeconds(originalEnd - start)),
        };
    }

    if (edit.mode === 'resize-end') {
        const maxDuration = Math.max(
            MIN_TIMELINE_ITEM_DURATION_SECONDS,
            flexibleDurationLimit - edit.originalStart,
        );

        return {
            start: edit.originalStart,
            duration: Math.max(
                MIN_TIMELINE_ITEM_DURATION_SECONDS,
                snapTimelineSeconds(clamp(edit.originalDuration + deltaSeconds, MIN_TIMELINE_ITEM_DURATION_SECONDS, maxDuration)),
            ),
        };
    }

    const maxStart = Math.max(0, flexibleDurationLimit - edit.originalDuration);

    return {
        start: snapTimelineSeconds(clamp(edit.originalStart + deltaSeconds, 0, maxStart)),
        duration: edit.originalDuration,
    };
}

function getTimelinePointerCaptureTarget(target: HTMLElement) {
    const button = target.closest('button');

    return button instanceof HTMLElement ? button : target;
}

function useActiveVisual(playhead: number, visualClips: VisualClip[]) {
    return useMemo(() => {
        return (
            visualClips.find((clip) => playhead >= clip.start && playhead < clip.start + clip.duration) ??
            visualClips[0]
        );
    }, [playhead, visualClips]);
}

function EffectBadges({ effects }: { effects: EffectId[] }) {
    if (effects.length === 0) {
        return null;
    }

    return (
        <span className="odx-effect-badges">
            {effects.map((effectId) => {
                const effect = effectById.get(effectId);

                return (
                    <span className="odx-effect-badge" key={effectId}>
                        {effect?.name ?? effectId}
                    </span>
                );
            })}
        </span>
    );
}

function CharacterAvatar({ characterId, size = 'md' }: { characterId: CharacterId; size?: 'sm' | 'md' | 'lg' }) {
    const character = characterById.get(characterId);

    if (!character) {
        return null;
    }

    return (
        <span className={`odx-avatar odx-avatar-${size}`} style={{ '--odx-avatar-color': character.color } as CSSProperties}>
            {character.initial}
        </span>
    );
}

function LibraryPanel({
    activePanelId,
    selectedId,
    visualClips,
    onApplyEffect,
    onSelectVisual,
}: {
    activePanelId: PanelId;
    selectedId: string;
    visualClips: VisualClip[];
    onApplyEffect: (effectId: EffectId) => void;
    onSelectVisual: (clipId: string) => void;
}) {
    const panel = panelDefinitions.find((definition) => definition.id === activePanelId) ?? panelDefinitions[0];

    return (
        <aside className="odx-libpanel">
            <div className="odx-panel-head">
                <div>
                    <p className="odx-eyebrow">LIBRARY</p>
                    <h2>{panel.title}</h2>
                </div>
                <button aria-label="검색" className="odx-icon-btn" type="button">
                    <StudioIcon name="search" size={17} />
                </button>
            </div>
            <p className="odx-panel-description">{panel.description}</p>
            <div className="odx-searchbar">
                <StudioIcon name="search" size={15} />
                <span>소스, 프리셋, 컷 검색</span>
            </div>
            <div className="odx-library-body">{renderPanelContent(activePanelId, selectedId, visualClips, onApplyEffect, onSelectVisual)}</div>
        </aside>
    );
}

function renderPanelContent(
    activePanelId: PanelId,
    selectedId: string,
    visualClips: VisualClip[],
    onApplyEffect: (effectId: EffectId) => void,
    onSelectVisual: (clipId: string) => void,
) {
    if (activePanelId === 'fx') {
        return (
            <div className="odx-panel-stack">
                {effectLibrary.map((effect) => (
                    <button className="odx-effect-card" key={effect.id} onClick={() => onApplyEffect(effect.id)} type="button">
                        <span className="odx-effect-icon">
                            <StudioIcon name={effect.icon} size={19} />
                        </span>
                        <span>
                            <strong>{effect.name}</strong>
                            <small>{effect.description}</small>
                            <em>{effect.preset}</em>
                        </span>
                    </button>
                ))}
            </div>
        );
    }

    if (activePanelId === 'char') {
        return (
            <div className="odx-panel-stack">
                {characters.map((character) => (
                    <button className="odx-character-row" key={character.id} type="button">
                        <CharacterAvatar characterId={character.id} size="lg" />
                        <span>
                            <strong>{character.name}</strong>
                            <small>{character.role}</small>
                            <em>{character.voice}</em>
                        </span>
                    </button>
                ))}
            </div>
        );
    }

    if (activePanelId === 'assets') {
        return (
            <div className="odx-cut-list">
                {visualClips.map((clip) => (
                    <button className={`odx-cut-card ${selectedId === clip.id ? 'is-selected' : ''}`} key={clip.id} onClick={() => onSelectVisual(clip.id)} type="button">
                        <span className="odx-cut-thumb" style={{ background: clip.background }} />
                        <span>
                            <strong>{clip.label}</strong>
                            <small>{clip.description}</small>
                            <em>
                                {formatTime(clip.start)} · {clip.duration}s
                            </em>
                        </span>
                    </button>
                ))}
            </div>
        );
    }

    if (activePanelId === 'audio') {
        return (
            <div className="odx-panel-stack">
                {audioAssets.map((asset) => (
                    <button className="odx-audio-asset" key={asset.title} type="button">
                        <span className="odx-wave-mini">
                            {waveformBars.slice(0, 9).map((height, index) => (
                                <i key={`${asset.title}-${height}-${index}`} style={{ height: `${height / 2}px` }} />
                            ))}
                        </span>
                        <span>
                            <strong>{asset.title}</strong>
                            <small>{asset.meta}</small>
                        </span>
                    </button>
                ))}
            </div>
        );
    }

    if (activePanelId === 'text') {
        return (
            <div className="odx-subtitle-list">
                {subtitleRows.map((row) => (
                    <button className="odx-subtitle-row" key={row.time} type="button">
                        <time>{row.time}</time>
                        <span>{row.text}</span>
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className="odx-settings-panel">
            <label>
                <span>영상 비율</span>
                <select defaultValue="9:16">
                    <option>9:16</option>
                    <option>16:9</option>
                    <option>1:1</option>
                </select>
            </label>
            <label>
                <span>출력 품질</span>
                <select defaultValue="1080p">
                    <option>1080p</option>
                    <option>1440p</option>
                    <option>4K</option>
                </select>
            </label>
            <label>
                <span>자막 언어</span>
                <select defaultValue="한국어">
                    <option>한국어</option>
                    <option>English</option>
                    <option>日本語</option>
                </select>
            </label>
        </div>
    );
}

function PreviewCanvas({
    activeVisual,
    playhead,
    previewZoom,
    effects,
    visualClips,
    scrollEvents,
    selectedId,
    onPreviewZoomChange,
    onPreviewZoomStep,
    onSelectScrollEvent,
    previewScrollEditingId,
    onPreviewScrollEditStart,
    onPreviewScrollEditMove,
    onPreviewScrollEditEnd,
}: {
    activeVisual: VisualClip;
    playhead: number;
    previewZoom: number;
    effects: EffectId[];
    visualClips: VisualClip[];
    scrollEvents: ScrollEventClip[];
    selectedId: string;
    onPreviewZoomChange: (zoom: number) => void;
    onPreviewZoomStep: (delta: number) => void;
    onSelectScrollEvent: (clipId: string) => void;
} & PreviewScrollPointerEditHandlers) {
    const activeScrollEvent = scrollEvents.find((event) => playhead >= event.start && playhead < event.start + event.duration);
    const selectedScrollEvent = scrollEvents.find((event) => event.id === selectedId);
    const handleScrollEvent = selectedScrollEvent ?? activeScrollEvent;

    return (
        <section className="odx-stage">
            <div className="odx-stage-toolbar">
                <div className="odx-tool-segment" role="group">
                    <button className="is-active" type="button">
                        <StudioIcon name="cursor" size={15} />
                        선택
                    </button>
                    <button type="button">
                        <StudioIcon name="move" size={15} />
                        이동
                    </button>
                    <button type="button">
                        <StudioIcon name="effect" size={15} />
                        효과
                    </button>
                </div>
                <div className="odx-stage-meta">
                    <span>세로형 1080x1920</span>
                    <span>{formatTime(playhead)}</span>
                </div>
                <div className="odx-stage-zoom" role="group" aria-label="이미지 스트립 확대">
                    <button aria-label="프리뷰 축소" onClick={() => onPreviewZoomStep(-PREVIEW_ZOOM_STEP)} type="button">
                        <StudioIcon name="minus" size={13} />
                    </button>
                    <input
                        aria-label="프리뷰 확대 비율"
                        max={MAX_PREVIEW_ZOOM}
                        min={MIN_PREVIEW_ZOOM}
                        onChange={(event) => onPreviewZoomChange(Number(event.target.value))}
                        step={PREVIEW_ZOOM_STEP}
                        type="range"
                        value={previewZoom}
                    />
                    <button aria-label="프리뷰 확대" onClick={() => onPreviewZoomStep(PREVIEW_ZOOM_STEP)} type="button">
                        <StudioIcon name="plus" size={13} />
                    </button>
                    <span>{Math.round(previewZoom * 100)}%</span>
                </div>
            </div>
            <div className="odx-preview-wrap">
                <div className="odx-phone" style={{ '--odx-preview-zoom': previewZoom } as CSSProperties}>
                    <div className="odx-phone-screen">
                        <div className="odx-webtoon-strip" style={{ transform: getPreviewTransform(playhead, visualClips) }}>
                            {visualClips.map((clip) => (
                                <article className={`odx-preview-cut ${clip.id === activeVisual.id ? 'is-active' : ''}`} key={clip.id} style={{ background: clip.background }}>
                                    <span>{clip.label}</span>
                                    <strong>{clip.description}</strong>
                                    {clip.bubble ? <p className={`odx-speech-bubble odx-speech-${clip.bubble.tone ?? 'default'}`}>{clip.bubble.text}</p> : null}
                                    {clip.subtitle ? <small>{clip.subtitle}</small> : null}
                                </article>
                            ))}
                        </div>
                        <div className="odx-preview-scroll-overlay">
                            {scrollEvents.map((event) => {
                                const isSelected = selectedId === event.id;
                                const isActive = activeScrollEvent?.id === event.id;

                                return (
                                    <button
                                        className={`odx-preview-scroll-event ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''} ${previewScrollEditingId === event.id ? 'is-pixel-editing' : ''}`}
                                        key={event.id}
                                        onClick={() => onSelectScrollEvent(event.id)}
                                        onPointerCancel={onPreviewScrollEditEnd}
                                        onPointerDown={(pointerEvent) => onPreviewScrollEditStart({ event: pointerEvent, item: event, mode: 'move' })}
                                        onPointerMove={onPreviewScrollEditMove}
                                        onPointerUp={onPreviewScrollEditEnd}
                                        style={getPreviewScrollEventStyle(event)}
                                        type="button"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="odx-preview-scroll-resize-handle odx-preview-scroll-resize-start"
                                            onPointerDown={(pointerEvent) => onPreviewScrollEditStart({ event: pointerEvent, item: event, mode: 'resize-start' })}
                                        />
                                        <span
                                            aria-hidden="true"
                                            className="odx-preview-scroll-resize-handle odx-preview-scroll-resize-end"
                                            onPointerDown={(pointerEvent) => onPreviewScrollEditStart({ event: pointerEvent, item: event, mode: 'resize-end' })}
                                        />
                                        <span>{event.label}</span>
                                        <small>{event.sublabel}</small>
                                    </button>
                                );
                            })}
                            {handleScrollEvent ? (
                                <>
                                    <span className="odx-scroll-strip-handle odx-scroll-strip-start" style={getPreviewScrollHandleStyle(handleScrollEvent.previewStartPx)}>
                                        시작
                                    </span>
                                    <span className="odx-scroll-strip-handle odx-scroll-strip-end" style={getPreviewScrollHandleStyle(handleScrollEvent.previewEndPx)}>
                                        종료
                                    </span>
                                </>
                            ) : null}
                        </div>
                        <div className="odx-preview-frame">
                            <div>
                                <b>{activeVisual.label}</b>
                                <span>{activeVisual.description}</span>
                            </div>
                            <EffectBadges effects={effects} />
                        </div>
                    </div>
                </div>
                <div className="odx-preview-side">
                    <button aria-label="소리 켜기" className="odx-icon-btn is-active" type="button">
                        <StudioIcon name="speaker" size={17} />
                    </button>
                    <button aria-label="전체 화면" className="odx-icon-btn" type="button">
                        <StudioIcon name="fullscreen" size={17} />
                    </button>
                    <button aria-label="잠금" className="odx-icon-btn" type="button">
                        <StudioIcon name="lock" size={17} />
                    </button>
                </div>
            </div>
        </section>
    );
}

function InspectorPanel({
    selectedItem,
    effects,
    activeVisual,
    trackById,
}: {
    selectedItem: Selection | undefined;
    effects: EffectId[];
    activeVisual: VisualClip;
    trackById: Map<string, AudioTrackDefinition>;
}) {
    const item = selectedItem ?? activeVisual;
    const isAudio = isTimelineClip(item);
    const isScrollEvent = isScrollEventClip(item);
    const itemTitle = isAudio ? item.label : `${item.label} · ${item.description}`;
    const itemMeta = isScrollEvent
        ? `시간 ${formatTime(item.start)} · 픽셀 ${item.previewStartPx}px -> ${item.previewEndPx}px`
        : isAudio
          ? `${trackById.get(item.track)?.label ?? item.track} · ${item.sublabel}`
          : `${item.kind.toUpperCase()} · ${item.duration}s`;

    return (
        <aside className="odx-inspector">
            <div className="odx-inspector-head">
                <p className="odx-eyebrow">INSPECTOR</p>
                <h2>{getItemTypeLabel(item, trackById)}</h2>
            </div>
            <div className="odx-inspector-body">
                <section className="odx-inspector-card">
                    <div className="odx-selected-title">
                        <span>{itemTitle}</span>
                        <small>{itemMeta}</small>
                    </div>
                    <dl className="odx-property-grid">
                        <div>
                            <dt>시작</dt>
                            <dd>{formatTime(item.start)}</dd>
                        </div>
                        <div>
                            <dt>길이</dt>
                            <dd>{item.duration.toFixed(1)}s</dd>
                        </div>
                        <div>
                            <dt>볼륨</dt>
                            <dd>{isScrollEvent ? '-' : isAudio ? '-5.0 dB' : '100%'}</dd>
                        </div>
                        <div>
                            <dt>상태</dt>
                            <dd>{effects.length > 0 ? '효과 적용' : '기본'}</dd>
                        </div>
                    </dl>
                </section>
                <section className="odx-inspector-card">
                    <h3>적용된 효과</h3>
                    <div className="odx-effect-stack">
                        {effects.length > 0 ? (
                            effects.map((effectId) => {
                                const effect = effectById.get(effectId);

                                return (
                                    <div className="odx-effect-line" key={effectId}>
                                        <StudioIcon name={effect?.icon ?? 'effect'} size={16} />
                                        <span>
                                            <strong>{effect?.name ?? effectId}</strong>
                                            <small>{effect?.preset ?? 'custom'}</small>
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="odx-empty-note">왼쪽 효과 패널에서 프리셋을 선택하면 이곳에 표시됩니다.</p>
                        )}
                    </div>
                </section>
                {isScrollEvent ? (
                    <section className="odx-inspector-card">
                        <h3>프리뷰 스크롤 픽셀</h3>
                        <div className="odx-scroll-geometry">
                            <div>
                                <span>시간 구간</span>
                                <b>
                                    {formatTime(item.start)}
                                    {' -> '}
                                    {formatTime(item.start + item.duration)}
                                </b>
                            </div>
                            <div>
                                <span>시작 픽셀</span>
                                <b>{Math.round(item.previewStartPx)} px</b>
                            </div>
                            <div>
                                <span>종료 픽셀</span>
                                <b>{Math.round(item.previewEndPx)} px</b>
                            </div>
                        </div>
                    </section>
                ) : null}
                <section className="odx-inspector-card">
                    <h3>오디오 분석</h3>
                    <div className="odx-meter">
                        {waveformBars.map((height, index) => (
                            <i key={`${height}-${index}`} style={{ height: `${height}px` }} />
                        ))}
                    </div>
                    <div className="odx-property-grid">
                        <div>
                            <dt>Peak</dt>
                            <dd>-3.1 dB</dd>
                        </div>
                        <div>
                            <dt>LUFS</dt>
                            <dd>-16.8</dd>
                        </div>
                    </div>
                </section>
                <section className="odx-inspector-card">
                    <h3>자동화</h3>
                    <div className="odx-automation-row">
                        <span>입장</span>
                        <b>fade · 0.35s</b>
                    </div>
                    <div className="odx-automation-row">
                        <span>감정톤</span>
                        <b>긴장 72%</b>
                    </div>
                    <div className="odx-automation-row">
                        <span>자막 싱크</span>
                        <b>+04f</b>
                    </div>
                </section>
            </div>
        </aside>
    );
}

function TimelineResizeHandles({
    item,
    itemKind,
    onTimelinePointerEditStart,
}: {
    item: TimelineEditableItem;
    itemKind: TimelineItemKind;
    onTimelinePointerEditStart: (request: TimelinePointerEditRequest) => void;
}) {
    return (
        <>
            <span
                aria-hidden="true"
                className="odx-timeline-resize-handle odx-timeline-resize-left"
                onPointerDown={(event) => onTimelinePointerEditStart({ event, itemKind, item, mode: 'resize-start' })}
            />
            <span
                aria-hidden="true"
                className="odx-timeline-resize-handle odx-timeline-resize-right"
                onPointerDown={(event) => onTimelinePointerEditStart({ event, itemKind, item, mode: 'resize-end' })}
            />
        </>
    );
}

function VisualTrack({
    scrollEvents,
    pxPerSecond,
    selectedId,
    effectsById,
    onSelect,
    draggingItemId,
    onTimelinePointerEditStart,
    onTimelinePointerEditMove,
    onTimelinePointerEditEnd,
}: {
    scrollEvents: ScrollEventClip[];
    pxPerSecond: number;
    selectedId: string;
    effectsById: Record<string, EffectId[]>;
    onSelect: (clipId: string) => void;
} & TimelinePointerEditHandlers) {
    return (
        <div className="odx-visual-track" style={{ height: `${VISUAL_TRACK_HEIGHT}px` }}>
            {scrollEvents.map((event) => {
                const effects = getItemEffects(event, effectsById);

                return (
                    <button
                        className={`odx-scroll-event-clip ${event.id === selectedId ? 'is-selected' : ''} ${draggingItemId === event.id ? 'is-dragging' : ''}`}
                        data-testid={`odx-clip-${event.id}`}
                        key={event.id}
                        onClick={() => onSelect(event.id)}
                        onPointerCancel={onTimelinePointerEditEnd}
                        onPointerDown={(pointerEvent) => onTimelinePointerEditStart({ event: pointerEvent, itemKind: 'scroll', item: event, mode: 'move' })}
                        onPointerMove={onTimelinePointerEditMove}
                        onPointerUp={onTimelinePointerEditEnd}
                        style={getClipStyle(event.start, event.duration, pxPerSecond)}
                        type="button"
                    >
                        <TimelineResizeHandles item={event} itemKind="scroll" onTimelinePointerEditStart={onTimelinePointerEditStart} />
                        <span>{event.label}</span>
                        <small>{event.sublabel}</small>
                        <EffectBadges effects={effects} />
                    </button>
                );
            })}
        </div>
    );
}

function AudioTracks({
    audioTracks,
    timelineClips,
    pxPerSecond,
    selectedId,
    effectsById,
    onSelect,
    draggingItemId,
    onTimelinePointerEditStart,
    onTimelinePointerEditMove,
    onTimelinePointerEditEnd,
}: {
    audioTracks: AudioTrackDefinition[];
    timelineClips: TimelineClip[];
    pxPerSecond: number;
    selectedId: string;
    effectsById: Record<string, EffectId[]>;
    onSelect: (clipId: string) => void;
} & TimelinePointerEditHandlers) {
    return (
        <>
            {audioTracks.map((track) => {
                const clips = timelineClips.filter((clip) => clip.track === track.id);

                return (
                    <div className="odx-track-lane" key={track.id} style={{ height: `${TIMELINE_TRACK_HEIGHT}px` }}>
                        {clips.map((clip) => {
                            const character = clip.characterId ? characterById.get(clip.characterId) : undefined;
                            const effects = getItemEffects(clip, effectsById);

                            return (
                                <button
                                    className={`odx-audio-clip ${clip.id === selectedId ? 'is-selected' : ''} ${draggingItemId === clip.id ? 'is-dragging' : ''}`}
                                    data-testid={`odx-clip-${clip.id}`}
                                    key={clip.id}
                                    onClick={() => onSelect(clip.id)}
                                    onPointerCancel={onTimelinePointerEditEnd}
                                    onPointerDown={(event) => onTimelinePointerEditStart({ event, itemKind: 'audio', item: clip, mode: 'move' })}
                                    onPointerMove={onTimelinePointerEditMove}
                                    onPointerUp={onTimelinePointerEditEnd}
                                    style={{
                                        ...getClipStyle(clip.start, clip.duration, pxPerSecond),
                                        '--odx-clip-bg': getTrackBackground(track),
                                        '--odx-clip-accent': character?.color ?? track.color ?? '#93a4b8',
                                    } as CSSProperties}
                                    type="button"
                                >
                                    <TimelineResizeHandles item={clip} itemKind="audio" onTimelinePointerEditStart={onTimelinePointerEditStart} />
                                    <span className="odx-clip-title">{clip.label}</span>
                                    <span className="odx-clip-meta">{clip.sublabel}</span>
                                    <EffectBadges effects={effects} />
                                </button>
                            );
                        })}
                    </div>
                );
            })}
        </>
    );
}

function Timeline({
    audioTracks,
    timelineClips,
    scrollEvents,
    timelineHeight,
    isTimelineHeightResizing,
    durationSeconds,
    playhead,
    pxPerSecond,
    selectedId,
    effectsById,
    onSelect,
    onScrub,
    onAddCue,
    onAddScrollEvent,
    onOpenTrackModal,
    onTimelineZoomChange,
    onTimelineZoomStep,
    draggingItemId,
    onTimelinePointerEditStart,
    onTimelinePointerEditMove,
    onTimelinePointerEditEnd,
    onTimelineHeightResizeStart,
    onTimelineHeightResizeMove,
    onTimelineHeightResizeEnd,
}: {
    audioTracks: AudioTrackDefinition[];
    timelineClips: TimelineClip[];
    scrollEvents: ScrollEventClip[];
    playhead: number;
    pxPerSecond: number;
    selectedId: string;
    effectsById: Record<string, EffectId[]>;
    onSelect: (clipId: string) => void;
    onScrub: (seconds: number) => void;
    onAddCue: () => void;
    onAddScrollEvent: () => void;
    onOpenTrackModal: () => void;
    onTimelineZoomChange: (pxPerSecond: number) => void;
    onTimelineZoomStep: (delta: number) => void;
    durationSeconds: number;
} & TimelinePointerEditHandlers & TimelinePanelResizeHandlers) {
    const ticks = Array.from({ length: Math.floor(durationSeconds / 6) + 1 }, (_, index) => index * 6);
    const contentWidth = durationSeconds * pxPerSecond;
    const rulerStyle = { width: `${contentWidth}px` };

    return (
        <section className={`odx-timeline ${isTimelineHeightResizing ? 'is-height-resizing' : ''}`} style={{ '--odx-timeline-height': `${timelineHeight}px` } as CSSProperties}>
            <div
                aria-label="타임라인 높이 조절"
                aria-orientation="horizontal"
                className="odx-timeline-resize-boundary"
                onPointerCancel={onTimelineHeightResizeEnd}
                onPointerDown={onTimelineHeightResizeStart}
                onPointerMove={onTimelineHeightResizeMove}
                onPointerUp={onTimelineHeightResizeEnd}
                role="separator"
                tabIndex={0}
            />
            <div className="odx-timeline-toolbar">
                <div className="odx-timeline-tool-group">
                    <button className="is-active" type="button">
                        <StudioIcon name="cursor" size={15} />
                    </button>
                    <button type="button">
                        <StudioIcon name="move" size={15} />
                    </button>
                    <button type="button">
                        <StudioIcon name="lock" size={15} />
                    </button>
                </div>
                <span className="odx-timeline-title">
                    타임라인 <b>{audioTracks.length + 1}</b> 트랙 · 길이 {formatTime(durationSeconds)}
                </span>
                <div className="odx-timeline-zoom" role="group" aria-label="타임라인 간격 조절">
                    <button aria-label="타임라인 축소" onClick={() => onTimelineZoomStep(-2)} type="button">
                        <span className="odx-zoom-lens" aria-hidden="true">
                            <StudioIcon name="search" size={14} />
                            <i>-</i>
                        </span>
                    </button>
                    <input
                        aria-label="타임라인 간격"
                        max={MAX_PX_PER_SECOND}
                        min={MIN_PX_PER_SECOND}
                        onChange={(event) => onTimelineZoomChange(Number(event.target.value))}
                        step={1}
                        type="range"
                        value={pxPerSecond}
                    />
                    <button aria-label="타임라인 확대" onClick={() => onTimelineZoomStep(2)} type="button">
                        <span className="odx-zoom-lens" aria-hidden="true">
                            <StudioIcon name="search" size={14} />
                            <i>+</i>
                        </span>
                    </button>
                </div>
                <div className="odx-timeline-action-row">
                    <button className="odx-timeline-action" onClick={onAddCue} type="button">
                        <StudioIcon name="plus" size={13} />
                        큐
                    </button>
                    <button className="odx-timeline-action" onClick={onAddScrollEvent} type="button">
                        <StudioIcon name="plus" size={13} />
                        스크롤 이벤트
                    </button>
                    <button className="odx-snap-pill is-active" type="button">
                        SNAP
                    </button>
                </div>
            </div>
            <div
                className="odx-timeline-left"
                style={{
                    gridTemplateRows: `28px ${VISUAL_TRACK_HEIGHT}px repeat(${audioTracks.length}, ${TIMELINE_TRACK_HEIGHT}px) 44px`,
                }}
            >
                <div className="odx-track-header odx-track-header-visual">
                    <span>스크롤 이벤트</span>
                    <small>VISUAL</small>
                </div>
                {audioTracks.map((track) => (
                    <div className="odx-track-header" key={track.id}>
                        <StudioIcon name={track.icon} size={15} />
                        <span>{track.label}</span>
                        <small>{track.sublabel}</small>
                        <span className="odx-track-toggle-row">
                            <button title={`${track.label} mute`} type="button">
                                M
                            </button>
                            <button title={`${track.label} solo`} type="button">
                                S
                            </button>
                            <button title={`${track.label} lock`} type="button">
                                L
                            </button>
                        </span>
                    </div>
                ))}
                <button className="odx-add-track" onClick={onOpenTrackModal} type="button">
                    <StudioIcon name="plus" size={14} />
                    트랙 추가
                </button>
            </div>
            <div className="odx-timeline-scroll">
                <div className="odx-ruler" style={rulerStyle}>
                    {ticks.map((tick) => (
                        <button className="odx-ruler-tick" key={tick} onClick={() => onScrub(tick)} style={{ left: `${tick * pxPerSecond}px` }} type="button">
                            <span>{formatTime(tick)}</span>
                        </button>
                    ))}
                </div>
                <div className="odx-track-stack" style={{ width: `${contentWidth}px` }}>
                    <VisualTrack
                        draggingItemId={draggingItemId}
                        effectsById={effectsById}
                        onSelect={onSelect}
                        onTimelinePointerEditEnd={onTimelinePointerEditEnd}
                        onTimelinePointerEditMove={onTimelinePointerEditMove}
                        onTimelinePointerEditStart={onTimelinePointerEditStart}
                        pxPerSecond={pxPerSecond}
                        scrollEvents={scrollEvents}
                        selectedId={selectedId}
                    />
                    <AudioTracks
                        audioTracks={audioTracks}
                        draggingItemId={draggingItemId}
                        effectsById={effectsById}
                        onSelect={onSelect}
                        onTimelinePointerEditEnd={onTimelinePointerEditEnd}
                        onTimelinePointerEditMove={onTimelinePointerEditMove}
                        onTimelinePointerEditStart={onTimelinePointerEditStart}
                        pxPerSecond={pxPerSecond}
                        selectedId={selectedId}
                        timelineClips={timelineClips}
                    />
                    <div className="odx-playhead" style={{ left: `${playhead * pxPerSecond}px` }}>
                        <span>{formatTime(playhead)}</span>
                    </div>
                </div>
            </div>
            <div className="odx-statusbar">
                <span>
                    SNAP <b>ON</b>
                </span>
                <span>
                    FPS <b>24</b>
                </span>
                <span>
                    LENGTH <b>{formatTime(durationSeconds)}</b>
                </span>
            </div>
        </section>
    );
}

export function StudioEditor({
    apiBaseUrl,
    episodeId,
    initialDraft: _initialDraft,
    initialManifest: _initialManifest,
}: {
    apiBaseUrl?: string;
    episodeId: string;
    initialDraft: PlayerDraft;
    initialManifest: PlayerManifest;
}) {
    const [activePanelId, setActivePanelId] = useState<PanelId>('fx');
    const [selectedId, setSelectedId] = useState('c3');
    const [playhead, setPlayhead] = useState(INITIAL_PLAYHEAD_SECONDS);
    const [isPlaying, setIsPlaying] = useState(false);
    const [pxPerSecond, setPxPerSecond] = useState(16);
    const [previewZoom, setPreviewZoom] = useState(1);
    const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE_PANEL_HEIGHT);
    const [effectsById, setEffectsById] = useState<Record<string, EffectId[]>>({});
    const [editableVisualClips, setEditableVisualClips] = useState<VisualClip[]>(fallbackVisualClips);
    const [timelineData, setTimelineData] = useState<TimelineData>(fallbackTimelineData);
    const [scrollEvents, setScrollEvents] = useState<ScrollEventClip[]>(fallbackScrollEvents);
    const [timelinePointerEdit, setTimelinePointerEdit] = useState<TimelinePointerEdit | null>(null);
    const [timelinePanelResize, setTimelinePanelResize] = useState<TimelinePanelResize | null>(null);
    const [previewScrollPointerEdit, setPreviewScrollPointerEdit] = useState<PreviewScrollPointerEdit | null>(null);
    const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
    const [newTrackType, setNewTrackType] = useState<TrackFormType>('record');
    const [newTrackName, setNewTrackName] = useState('');
    const stageStripRef = useRef<HTMLDivElement | null>(null);
    const resolvedApiBaseUrl = apiBaseUrl || 'http://127.0.0.1:4100';
    const visualClipById = useMemo(() => new Map(editableVisualClips.map((clip) => [clip.id, clip])), [editableVisualClips]);
    const audioTrackById = useMemo(() => new Map(timelineData.audioTracks.map((track) => [track.id, track])), [timelineData.audioTracks]);
    const audioClipById = useMemo(() => new Map(timelineData.timelineClips.map((clip) => [clip.id, clip])), [timelineData.timelineClips]);
    const scrollEventById = useMemo(() => new Map(scrollEvents.map((event) => [event.id, event])), [scrollEvents]);
    const timelineDurationSeconds = useMemo(() => {
        const maxAudioEnd = timelineData.timelineClips.reduce((maxEnd, clip) => Math.max(maxEnd, clip.start + clip.duration), 0);
        const maxScrollEnd = scrollEvents.reduce((maxEnd, event) => Math.max(maxEnd, event.start + event.duration), 0);
        return Math.max(TIMELINE_DURATION_SECONDS, Math.ceil(maxAudioEnd), Math.ceil(maxScrollEnd));
    }, [scrollEvents, timelineData.timelineClips]);
    const activeVisual = useActiveVisual(playhead, editableVisualClips);
    const selectedItem = getSelectedItem(selectedId, visualClipById, audioClipById, scrollEventById);
    const selectedEffects = getItemEffects(selectedItem ?? activeVisual, effectsById);

    useEffect(() => {
        let ignore = false;

        listTracks(resolvedApiBaseUrl, episodeId)
            .then((tracks) => {
                if (!ignore && tracks.length > 0) {
                    setTimelineData(toTimelineData(tracks));
                }
            })
            .catch(() => undefined);

        return () => {
            ignore = true;
        };
    }, [episodeId, resolvedApiBaseUrl]);

    useEffect(() => {
        if (!isPlaying) {
            return undefined;
        }

        let animationFrame = 0;
        let previousTimestamp = performance.now();

        const step = (timestamp: number) => {
            const elapsedSeconds = (timestamp - previousTimestamp) / 1000;
            previousTimestamp = timestamp;

            setPlayhead((current) => {
                const next = clamp(current + elapsedSeconds, 0, timelineDurationSeconds);

                if (next >= timelineDurationSeconds) {
                    setIsPlaying(false);
                }

                return next;
            });

            animationFrame = requestAnimationFrame(step);
        };

        animationFrame = requestAnimationFrame(step);

        return () => cancelAnimationFrame(animationFrame);
    }, [isPlaying, timelineDurationSeconds]);

    useEffect(() => {
        if (!stageStripRef.current) {
            return;
        }

        const maxScrollTop = stageStripRef.current.scrollHeight - stageStripRef.current.clientHeight;
        stageStripRef.current.scrollTop = clamp((playhead / timelineDurationSeconds) * maxScrollTop, 0, maxScrollTop);
    }, [playhead, timelineDurationSeconds]);

    const handleSelectVisual = (clipId: string) => {
        const clip = visualClipById.get(clipId);

        setSelectedId(clipId);

        if (clip) {
            setPlayhead(clip.start + 0.15);
        }
    };

    const handleApplyEffect = (effectId: EffectId) => {
        const targetId = selectedId || activeVisual.id;

        setEffectsById((current) => {
            const existing = current[targetId] ?? getSelectedItem(targetId, visualClipById, audioClipById, scrollEventById)?.effects ?? [];

            if (existing.includes(effectId)) {
                return current;
            }

            return {
                ...current,
                [targetId]: [...existing, effectId],
            };
        });
    };

    const handleScrub = (seconds: number) => {
        setIsPlaying(false);
        setPlayhead(clamp(seconds, 0, timelineDurationSeconds));
    };

    const handleStartTimelinePointerEdit = ({
        event,
        itemKind,
        item,
        mode,
    }: TimelinePointerEditRequest) => {
        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);

        event.preventDefault();
        event.stopPropagation();
        captureTarget.setPointerCapture(event.pointerId);
        setIsPlaying(false);
        setSelectedId(item.id);
        setPlayhead(clamp(item.start, 0, timelineDurationSeconds));
        setTimelinePointerEdit({
            itemId: item.id,
            itemKind,
            mode,
            pointerStartX: event.clientX,
            originalStart: item.start,
            originalDuration: item.duration,
        });
    };

    const handleMoveTimelinePointerEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!timelinePointerEdit) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const timing = getTimelineEditTiming(timelinePointerEdit, event.clientX, pxPerSecond, timelineDurationSeconds);

        if (timelinePointerEdit.itemKind === 'scroll') {
            setScrollEvents((current) =>
                current.map((scrollEvent) =>
                    scrollEvent.id === timelinePointerEdit.itemId
                        ? { ...scrollEvent, start: timing.start, duration: timing.duration }
                        : scrollEvent,
                ),
            );
        } else {
            setTimelineData((current) => ({
                ...current,
                timelineClips: current.timelineClips.map((clip) =>
                    clip.id === timelinePointerEdit.itemId ? { ...clip, start: timing.start, duration: timing.duration } : clip,
                ),
            }));
        }

        setPlayhead(timing.start);
    };

    const handleEndTimelinePointerEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!timelinePointerEdit) {
            return;
        }

        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);

        event.preventDefault();
        event.stopPropagation();

        if (captureTarget.hasPointerCapture(event.pointerId)) {
            captureTarget.releasePointerCapture(event.pointerId);
        }

        setTimelinePointerEdit(null);
    };

    const handleStartTimelineHeightResize = (event: ReactPointerEvent<HTMLElement>) => {
        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);

        event.preventDefault();
        event.stopPropagation();
        captureTarget.setPointerCapture(event.pointerId);
        setIsPlaying(false);
        setTimelinePanelResize({
            pointerStartY: event.clientY,
            originalHeight: timelineHeight,
        });
    };

    const handleMoveTimelineHeightResize = (event: ReactPointerEvent<HTMLElement>) => {
        if (!timelinePanelResize) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        setTimelineHeight(
            clamp(
                timelinePanelResize.originalHeight - (event.clientY - timelinePanelResize.pointerStartY),
                MIN_TIMELINE_PANEL_HEIGHT,
                MAX_TIMELINE_PANEL_HEIGHT,
            ),
        );
    };

    const handleEndTimelineHeightResize = (event: ReactPointerEvent<HTMLElement>) => {
        if (!timelinePanelResize) {
            return;
        }

        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);

        event.preventDefault();
        event.stopPropagation();

        if (captureTarget.hasPointerCapture(event.pointerId)) {
            captureTarget.releasePointerCapture(event.pointerId);
        }

        setTimelinePanelResize(null);
    };

    const handleStartPreviewScrollEdit = ({
        event,
        item,
        mode,
    }: PreviewScrollPointerEditRequest) => {
        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);

        event.preventDefault();
        event.stopPropagation();
        captureTarget.setPointerCapture(event.pointerId);
        setIsPlaying(false);
        setSelectedId(item.id);
        setPreviewScrollPointerEdit({
            eventId: item.id,
            mode,
            pointerStartY: event.clientY,
            overlayHeightPx: getPreviewOverlayHeight(event.currentTarget),
            originalStartPx: item.previewStartPx,
            originalEndPx: item.previewEndPx,
        });
    };

    const handleMovePreviewScrollEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!previewScrollPointerEdit) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const pixels = getPreviewScrollEditPixels(previewScrollPointerEdit, event.clientY);

        setScrollEvents((current) =>
            current.map((scrollEvent) =>
                scrollEvent.id === previewScrollPointerEdit.eventId
                    ? {
                          ...scrollEvent,
                          ...pixels,
                          sublabel: formatPreviewScrollLabel(pixels.previewStartPx, pixels.previewEndPx),
                      }
                    : scrollEvent,
            ),
        );
    };

    const handleEndPreviewScrollEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!previewScrollPointerEdit) {
            return;
        }

        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);

        event.preventDefault();
        event.stopPropagation();

        if (captureTarget.hasPointerCapture(event.pointerId)) {
            captureTarget.releasePointerCapture(event.pointerId);
        }

        setPreviewScrollPointerEdit(null);
    };

    const handleAddCue = () => {
        const selectedClip = audioClipById.get(selectedId);
        const fallbackTrack = timelineData.audioTracks.find((track) => track.kind !== 'scroll') ?? timelineData.audioTracks[0];
        const targetTrackId = selectedClip?.track ?? fallbackTrack?.id;

        if (!targetTrackId) {
            return;
        }

        const targetTrack = audioTrackById.get(targetTrackId);
        const start = snapTimelineSeconds(playhead);
        const id = `local-cue-${Date.now().toString(36)}`;
        const clip: TimelineClip = {
            id,
            track: targetTrackId,
            start,
            duration: 4,
            label: getDefaultCueLabel(targetTrack?.kind),
            sublabel: targetTrack?.kind === 'record' ? '대사 입력 대기' : '신규 클립',
        };

        setTimelineData((current) => ({
            ...current,
            timelineClips: [...current.timelineClips, clip],
        }));
        setIsPlaying(false);
        setSelectedId(id);
        setPlayhead(start);
    };

    const handleAddScrollEvent = () => {
        const start = snapTimelineSeconds(playhead);
        const id = `local-scroll-${Date.now().toString(36)}`;
        const previewStartPx = Math.round(clamp((playhead / timelineDurationSeconds) * PREVIEW_SCROLL_STRIP_HEIGHT_PX, 0, PREVIEW_SCROLL_STRIP_HEIGHT_PX - 300));
        const previewEndPx = previewStartPx + 300;
        const event: ScrollEventClip = {
            id,
            track: 'visual',
            start,
            duration: 5,
            label: '새 스크롤 이벤트',
            sublabel: `${previewStartPx}px -> ${previewEndPx}px`,
            previewStartPx,
            previewEndPx,
        };

        setScrollEvents((current) => [...current, event].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)));
        setIsPlaying(false);
        setSelectedId(id);
        setPlayhead(start);
    };

    const handleOpenTrackModal = () => {
        setNewTrackType('record');
        setNewTrackName('');
        setIsTrackModalOpen(true);
    };

    const handleAddTrack = () => {
        const trackType = newTrackType;
        const trackName = newTrackName.trim() || getDefaultTrackName(trackType);
        const trackId = `local-track-${Date.now().toString(36)}`;
        const track: AudioTrackDefinition = {
            id: trackId,
            label: trackName,
            sublabel: getTrackKindLabel(trackType),
            icon: getTrackKindIcon(trackType),
            kind: trackType,
            color: trackType === 'record' ? trackColorPalette[timelineData.audioTracks.length % trackColorPalette.length] : undefined,
        };
        const start = snapTimelineSeconds(playhead);
        const clip: TimelineClip = {
            id: `local-cue-${Date.now().toString(36)}`,
            track: trackId,
            start,
            duration: 4,
            label: getDefaultCueLabel(trackType),
            sublabel: trackType === 'record' ? '대사 입력 대기' : '신규 클립',
        };

        setTimelineData((current) => ({
            audioTracks: [...current.audioTracks, track],
            timelineClips: trackType === 'scroll' ? current.timelineClips : [...current.timelineClips, clip],
        }));
        setIsTrackModalOpen(false);
        setSelectedId(trackType === 'scroll' ? selectedId : clip.id);
        setPlayhead(start);
    };

    return (
        <div className="odx-editor" data-testid="tooned-index-editor">
            <header className="odx-topbar">
                <div className="odx-brand">
                    <span>Tooned</span>
                    <b>Studio</b>
                </div>
                <nav className="odx-menu" aria-label="제작 메뉴">
                    <button type="button">파일</button>
                    <button type="button">편집</button>
                    <button type="button">보기</button>
                    <button type="button">도움말</button>
                </nav>
                <div className="odx-project">
                    <strong>학원의 비밀</strong>
                    <span>EP.07 · 컷/음성 연출</span>
                    <em className="odx-saved-status">자동 저장됨</em>
                </div>
                <div className="odx-transport" role="group" aria-label="재생 제어">
                    <button aria-label="이전 컷" className="odx-icon-btn" onClick={() => handleScrub(Math.max(0, playhead - 5))} type="button">
                        <StudioIcon name="minus" size={16} />
                    </button>
                    <button aria-label={isPlaying ? '일시정지' : '재생'} className="odx-play-btn" onClick={() => setIsPlaying((current) => !current)} type="button">
                        <StudioIcon name={isPlaying ? 'pause' : 'play'} size={18} />
                    </button>
                    <button aria-label="다음 컷" className="odx-icon-btn" onClick={() => handleScrub(Math.min(timelineDurationSeconds, playhead + 5))} type="button">
                        <StudioIcon name="plus" size={16} />
                    </button>
                    <span>{formatTime(playhead)}</span>
                </div>
                <div className="odx-top-actions">
                    <button className="odx-top-action" type="button">
                        <StudioIcon name="mic" size={16} />
                        음성 합성
                    </button>
                    <button className="odx-top-action odx-primary-action" type="button">
                        <StudioIcon name="download" size={16} />
                        내보내기
                    </button>
                    <span className="odx-user">N</span>
                </div>
            </header>
            <main className="odx-body">
                <aside className="odx-rail" aria-label="제작 도구">
                    {panelDefinitions.map((panel) => (
                        <button className={activePanelId === panel.id ? 'is-active' : ''} key={panel.id} onClick={() => setActivePanelId(panel.id)} title={panel.title} type="button">
                            <StudioIcon name={panel.icon} size={20} />
                            <span>{panel.label}</span>
                        </button>
                    ))}
                </aside>
                <LibraryPanel
                    activePanelId={activePanelId}
                    onApplyEffect={handleApplyEffect}
                    onSelectVisual={handleSelectVisual}
                    selectedId={selectedId}
                    visualClips={editableVisualClips}
                />
                <PreviewCanvas
                    activeVisual={activeVisual}
                    effects={getItemEffects(activeVisual, effectsById)}
                    onPreviewZoomChange={(zoom) => setPreviewZoom(clamp(zoom, MIN_PREVIEW_ZOOM, MAX_PREVIEW_ZOOM))}
                    onPreviewZoomStep={(delta) => setPreviewZoom((current) => clamp(current + delta, MIN_PREVIEW_ZOOM, MAX_PREVIEW_ZOOM))}
                    onSelectScrollEvent={setSelectedId}
                    onPreviewScrollEditEnd={handleEndPreviewScrollEdit}
                    onPreviewScrollEditMove={handleMovePreviewScrollEdit}
                    onPreviewScrollEditStart={handleStartPreviewScrollEdit}
                    playhead={playhead}
                    previewZoom={previewZoom}
                    previewScrollEditingId={previewScrollPointerEdit?.eventId ?? null}
                    scrollEvents={scrollEvents}
                    selectedId={selectedId}
                    visualClips={editableVisualClips}
                />
                <InspectorPanel activeVisual={activeVisual} effects={selectedEffects} selectedItem={selectedItem} trackById={audioTrackById} />
                <Timeline
                    audioTracks={timelineData.audioTracks}
                    draggingItemId={timelinePointerEdit?.itemId ?? null}
                    durationSeconds={timelineDurationSeconds}
                    effectsById={effectsById}
                    isTimelineHeightResizing={timelinePanelResize !== null}
                    onAddCue={handleAddCue}
                    onAddScrollEvent={handleAddScrollEvent}
                    onOpenTrackModal={handleOpenTrackModal}
                    onScrub={handleScrub}
                    onSelect={setSelectedId}
                    onTimelineHeightResizeEnd={handleEndTimelineHeightResize}
                    onTimelineHeightResizeMove={handleMoveTimelineHeightResize}
                    onTimelineHeightResizeStart={handleStartTimelineHeightResize}
                    onTimelinePointerEditEnd={handleEndTimelinePointerEdit}
                    onTimelinePointerEditMove={handleMoveTimelinePointerEdit}
                    onTimelinePointerEditStart={handleStartTimelinePointerEdit}
                    onTimelineZoomChange={(nextPxPerSecond) => setPxPerSecond(clamp(nextPxPerSecond, MIN_PX_PER_SECOND, MAX_PX_PER_SECOND))}
                    onTimelineZoomStep={(delta) => setPxPerSecond((current) => clamp(current + delta, MIN_PX_PER_SECOND, MAX_PX_PER_SECOND))}
                    playhead={playhead}
                    pxPerSecond={pxPerSecond}
                    scrollEvents={scrollEvents}
                    selectedId={selectedId}
                    timelineHeight={timelineHeight}
                    timelineClips={timelineData.timelineClips}
                />
            </main>
            {isTrackModalOpen ? (
                <div className="odx-track-modal-overlay" role="presentation" onClick={() => setIsTrackModalOpen(false)}>
                    <form
                        className="odx-track-modal"
                        onClick={(event) => event.stopPropagation()}
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleAddTrack();
                        }}
                    >
                        <div className="odx-track-modal-head">
                            <span>새 트랙 추가</span>
                            <button aria-label="닫기" className="odx-icon-btn" onClick={() => setIsTrackModalOpen(false)} type="button">
                                <StudioIcon name="minus" size={15} />
                            </button>
                        </div>
                        <label className="odx-track-modal-field">
                            <span>트랙 유형</span>
                            <select value={newTrackType} onChange={(event) => setNewTrackType(event.target.value as TrackFormType)}>
                                <option value="record">캐릭터 보이스</option>
                                <option value="audio">내레이션 / 오디오</option>
                                <option value="bgm">BGM</option>
                                <option value="effect">SFX / 효과음</option>
                                <option value="scroll">스크롤 트랙</option>
                            </select>
                        </label>
                        <label className="odx-track-modal-field">
                            <span>트랙 이름</span>
                            <input
                                autoFocus
                                onChange={(event) => setNewTrackName(event.target.value)}
                                placeholder="예: 조연 보이스 · 회상 BGM"
                                value={newTrackName}
                            />
                        </label>
                        <div className="odx-track-modal-actions">
                            <button className="odx-modal-sub" onClick={() => setIsTrackModalOpen(false)} type="button">
                                취소
                            </button>
                            <button className="odx-modal-apply" type="submit">
                                트랙 추가
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
            <div className="odx-strip-sync" ref={stageStripRef} aria-hidden="true">
                {stripMarkers.map((marker) => (
                    <span key={marker}>{marker}</span>
                ))}
            </div>
        </div>
    );
}
