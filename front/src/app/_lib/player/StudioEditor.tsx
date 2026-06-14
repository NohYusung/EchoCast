'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { StudioEpisodeDetails } from './getEpisodeDetails';
import { getCutEditMediaDetails } from './cutEditMediaDetails';
import {
    confirmImageCompositionDraft,
    createEmptyImageCompositionDraft,
    syncImageCompositionDraft,
    toCanvasCreateMedias,
    type ImageCompositionCanvasMedia,
    type ImageCompositionDraft,
    type ImageCompositionSource,
} from './imageComposition';
import { getAudioDuration } from './audioDuration';
import { audioInspectorSectionIds } from './audioInspectorSections';
import { getAudioUploadCandidateKind, prepareAudioUploadFile } from './audioFileExtraction';
import { getVideoDuration } from './videoDuration';
import { getActiveCuePlaybackProgressLabel, getCuePlaybackProgressLabel } from './cuePlaybackProgress';
import {
    stopStudioTimelineAudioPlayback,
    syncStudioTimelineAudioPlayback,
    type StudioTimelineAudioState,
} from './studioTimelineAudioPlayback';
import {
    buildFileUploadUrlRequests,
    buildMediaUploadQueue,
    buildMediaRegistrationRequest,
    getUploadContentType,
    toMediaUploadFailureMessage,
    uploadFileToPresignedUrl,
    type FileUploadUrlRequest,
    type MediaUploadFailure,
} from './mediaUploadBatch';
import {
    buildMediaDragPayload,
    getNextMediaSelection,
    parseMediaDragPayload,
} from './mediaDragSelection';
import {
    filterPreviewCanvasItems,
    getPreviewCanvasOptions,
    resolvePreviewCanvasId,
    type PreviewCanvasOption,
} from './previewCanvasSelection';
import { previewModeDefinitions, type PreviewMode } from './previewModes';
import {
    getCueApiIdFromTimelineClipId,
    resolveCueTimelineTrackId,
    toClickedCuePositionRequest,
    toCuePositionUpdateRequest,
    toCueStripMarker,
    toCueMutationTarget,
    toCueTimingUpdateRequest,
    type CueStripPositionRequest,
} from './cueTimelinePersistence';
import type { PlayerDraft } from './playerDraft.types';
import type { PlayerManifest } from './playerManifest.types';
import {
    getPreviewScrollAnchor,
    getPreviewScrollOffset,
    getPreviewScrollOffsetForAnchor,
    getPreviewScrollPixel,
    getPreviewScrollPosition,
    getSelectedPreviewVisual,
    type PreviewScrollAnchor,
    type PreviewScrollPositionEvent,
    type PreviewScrollVisualSegment,
} from './previewScrollPosition';
import { syncPreviewVideoPlayback } from './previewVideoPlayback';
import {
    getScrollEventApiId,
    toClickedScrollAnchorMutationRequest,
    toDraggedScrollAnchorMutationRequest,
    toScrollAnchorMutationRequests,
    toScrollEventMutationRequest,
    toTimelineDraggedScrollAnchorMutationRequest,
    type ScrollAnchorMutationRequest,
    type ScrollEventMutationRequest,
} from './scrollEventPersistence';
import {
    clampTimelineAudioResizeTiming,
    getTimelineAudioClipMaxDurationSeconds,
    getTimelineResizeMinDurationSeconds,
    getTimelineSidebarResizeWidth,
} from './timelineResize';
import { getTimelineScrubState } from './timelineScrub';
import { getTrackDeleteUrl, toTrackMutationTarget } from './trackPersistence';
import {
    getAnchorDeleteUrl,
    getAnchorEventDeleteUrl,
    resolveAnchorPlacementTrackId,
    toAnchorMutationTarget,
} from './anchorPersistence';

const TIMELINE_DURATION_SECONDS = 72;
const TIMELINE_TRACK_HEIGHT = 58;
const VIDEO_TIMELINE_TRACK_ID = 'canvas-video-track';
const PREVIEW_CUT_HEIGHT = 198;
const PREVIEW_SCROLL_STRIP_HEIGHT_PX = 2400;
const INITIAL_PLAYHEAD_SECONDS = 18.4;
const DEFAULT_PX_PER_SECOND = 16;
const MIN_PX_PER_SECOND = 0.6;
const MAX_PX_PER_SECOND = 80;
const MIN_TIMELINE_GRIDLINE_PX = 56;
const MIN_PREVIEW_ZOOM = 0.75;
const MAX_PREVIEW_ZOOM = 1.55;
const PREVIEW_ZOOM_STEP = 0.05;
const DEFAULT_PREVIEW_CANVAS_WIDTH = 420;
const DEFAULT_PREVIEW_CANVAS_HEIGHT = 760;
const MIN_PREVIEW_CANVAS_WIDTH = 260;
const MIN_PREVIEW_CANVAS_HEIGHT = 360;
const DEFAULT_TIMELINE_PANEL_HEIGHT = 336;
const MIN_TIMELINE_PANEL_HEIGHT = 220;
const MAX_TIMELINE_PANEL_HEIGHT = 620;
const DEFAULT_TIMELINE_SIDEBAR_WIDTH = 184;
const MIN_TIMELINE_SIDEBAR_WIDTH = 150;
const MAX_TIMELINE_SIDEBAR_WIDTH = 340;
const DEFAULT_INSPECTOR_WIDTH = 312;
const MIN_INSPECTOR_WIDTH = 260;
const MAX_INSPECTOR_WIDTH = 560;
const MIN_TIMELINE_ITEM_DURATION_SECONDS = 0.5;
const TIMELINE_RESIZE_EXTENSION_SECONDS = 24;
const TIMELINE_SNAP_SECONDS = 0.5;
const TIMELINE_GRID_STEPS_SECONDS = [1, 2, 5, 10, 30, 60, 120] as const;
const SCROLL_POSITION_STEP_PX = 24;
const MEDIA_DRAG_MIME = 'application/x-tooned-media-id';
const MEDIA_BATCH_DRAG_MIME = 'application/x-tooned-media-ids';
const AUDIO_DRAG_MIME = 'application/x-tooned-audio-id';
const CANVAS_MEDIA_SEQUENCE_UNIT_SECONDS = 1;
const defaultAnchorEventDraft: AnchorEventDraft = {
    type: 'scroll',
    endAnchorId: '',
    duration: '1000',
    isSaving: false,
    error: null,
};

type PanelId = 'fx' | 'char' | 'assets' | 'audio' | 'text' | 'settings';
type CharacterId = string;
type AudioTrackId = string;
type TrackApiType = 'scroll' | 'scrolls' | 'record' | 'audio' | 'effect' | 'bgm';
type AudioType = 'audio' | 'bgm' | 'effect' | 'tts';
type MediaType = 'audio' | 'video' | 'image';
type CharacterRole = 'starring' | 'supporting' | 'minor' | 'narrator' | 'unknown';
type EffectId = 'fadeIn' | 'fadeOut' | 'zoom' | 'shake' | 'spark';
type IconName =
    | 'anchor'
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
    | 'selectLeft'
    | 'selectRight'
    | 'settings'
    | 'split'
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
    meta: string;
    imageUrl?: string;
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
    characterId?: CharacterId;
    color?: string;
};

type TimelineClip = {
    id: string;
    track: AudioTrackId;
    start: number;
    duration: number;
    label: string;
    sublabel: string;
    audioId?: number;
    audioUrl?: string;
    audioStart?: number;
    audioEnd?: number;
    audioDuration?: number;
    characterId?: CharacterId;
    effects?: EffectId[];
    volume?: number;
    startCanvasMediaId?: number;
    endCanvasMediaId?: number;
    startPosition?: number;
    endPosition?: number;
};

type ScrollEventClip = TimelineClip & {
    scrollId?: number;
    startAnchorId?: number;
    endAnchorId?: number;
    canvasId?: number;
    startIndex?: number;
    endIndex?: number;
    startPosition: number;
    endPosition: number;
};

type VisualClip = {
    id: string;
    canvasId?: number;
    canvasMediaId?: number;
    index?: number;
    mediaId: number;
    mediaDuration?: number;
    hasTimelineControls?: boolean;
    sourceStart?: number;
    sourceEnd?: number;
    volume?: number;
    isMuted?: boolean;
    kind: 'cut' | 'video';
    start: number;
    duration: number;
    label: string;
    description: string;
    background: string;
    mediaUrl?: string;
    mediaType?: Exclude<MediaType, 'audio'>;
    effects?: EffectId[];
    bubble?: {
        text: string;
        tone?: 'default' | 'right' | 'narration';
    };
    subtitle?: string;
};

type CutEditCanvasSummary = {
    id: number;
    label: string;
    sublabel: string;
    layerCount: number;
    clips: VisualClip[];
};

type CutEditCueTrack = {
    id: string;
    label: string;
    color?: string;
    cues: TrackCueListItem[];
};

type CutEditCueMarker = {
    cue: TrackCueListItem;
    cueId: string;
    trackId: string;
    trackLabel: string;
    trackIndex: number;
    top: number;
    endTop: number;
};

type AnchorSelection = {
    id: string;
    anchorId: number;
    trackId: string;
    canvasId: number;
    time: number;
    position: number;
    index: number;
    event: AnchorEvent | null;
    label: string;
    sublabel: string;
};
type Selection = TimelineClip | VisualClip | AnchorSelection;
type TimelineItemKind = 'scroll' | 'audio' | 'video';
type TimelineEditMode = 'move' | 'resize-start' | 'resize-end';
type TimelineToolMode = 'select' | 'split' | 'selectL' | 'selectR';
type TimelineEditableItem = Pick<TimelineClip | VisualClip, 'id' | 'start' | 'duration'>;
type VisualCutEditMode = 'reorder' | 'duration';
type TimelinePointerEdit = {
    itemId: string;
    itemKind: TimelineItemKind;
    mode: TimelineEditMode;
    pointerStartX: number;
    originalStart: number;
    originalDuration: number;
    maxDuration?: number;
};
type TimelineAnchorPointerEdit = {
    anchor: AnchorListItem;
    pointerStartX: number;
    originalTimeSeconds: number;
    hasMoved: boolean;
};
type TimelinePointerEditRequest = {
    event: ReactPointerEvent<HTMLElement>;
    itemKind: TimelineItemKind;
    item: TimelineEditableItem;
    mode: TimelineEditMode;
};
type TimelineAnchorPointerEditRequest = {
    event: ReactPointerEvent<HTMLElement>;
    anchor: AnchorListItem;
};
type VideoClipControlPatch = Partial<Pick<VisualClip, 'sourceStart' | 'sourceEnd' | 'volume' | 'isMuted'>>;
type TimelinePointerEditHandlers = {
    draggingItemId: string | null;
    onTimelinePointerEditStart: (request: TimelinePointerEditRequest) => void;
    onTimelinePointerEditMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onTimelinePointerEditEnd: (event: ReactPointerEvent<HTMLElement>) => void;
};
type TimelineAnchorPointerEditHandlers = {
    timelineAnchorEditingId: number | null;
    onTimelineAnchorEditStart: (request: TimelineAnchorPointerEditRequest) => void;
    onTimelineAnchorEditMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onTimelineAnchorEditEnd: (event: ReactPointerEvent<HTMLElement>) => void;
};
type TimelinePanelResize = {
    pointerStartY: number;
    originalHeight: number;
};
type TimelineSidebarResize = {
    pointerStartX: number;
    originalWidth: number;
};
type InspectorResize = {
    pointerStartX: number;
    originalWidth: number;
};
type PreviewCanvasSize = {
    width: number;
    height: number;
};
type PreviewCanvasResize = {
    pointerStartX: number;
    pointerStartY: number;
    originalWidth: number;
    originalHeight: number;
    maxWidth: number;
    maxHeight: number;
};
type StudioEditorEpisode = Pick<StudioEpisodeDetails, 'episodeNumber' | 'title' | 'subTitle'>;
type VisualCutPointerEdit = {
    clipId: string;
    mode: VisualCutEditMode;
    pointerStartY: number;
    originalBlockHeight: number;
    originalIndex: number;
    originalDuration: number;
};
type MediaContextMenuState = {
    clipId: string;
    mediaId: number;
    x: number;
    y: number;
};
type TrackContextMenuState = {
    trackId: string;
    trackLabel: string;
    x: number;
    y: number;
};
type TimelinePanelResizeHandlers = {
    timelineHeight: number;
    timelineSidebarWidth: number;
    isTimelineHeightResizing: boolean;
    isTimelineSidebarResizing: boolean;
    onTimelineHeightResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
    onTimelineSidebarResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
};
type PreviewScrollEditMode = 'move' | 'resize-start' | 'resize-end';
type PreviewScrollPointerEdit = {
    eventId: string;
    mode: PreviewScrollEditMode;
    pointerStartY: number;
    coordinateHeightPx: number;
    visualSegments: PreviewScrollVisualSegment[];
    originalStartPixel: number;
    originalEndPixel: number;
};
type PreviewAnchorPointerEdit = {
    anchor: AnchorListItem;
    pointerStartY: number;
    coordinateHeightPx: number;
    visualSegments: PreviewScrollVisualSegment[];
    originalPixel: number;
    hasMoved: boolean;
};
type PreviewCuePointerEdit = {
    cue: TrackCueListItem;
    trackId: string;
    pointerStartY: number;
    coordinateHeightPx: number;
    visualClips: VisualClip[];
    visualSegments: PreviewScrollVisualSegment[];
    originalStartPixel: number;
    originalEndPixel: number;
    hasMoved: boolean;
};
type PreviewScrollPointerEditRequest = {
    event: ReactPointerEvent<HTMLElement>;
    item: ScrollEventClip;
    mode: PreviewScrollEditMode;
};
type PreviewAnchorPointerEditRequest = {
    event: ReactPointerEvent<HTMLElement>;
    anchor: AnchorListItem;
    top: number;
};
type PreviewCuePointerEditRequest = {
    event: ReactPointerEvent<HTMLElement>;
    marker: CutEditCueMarker;
};
type PreviewScrollPointerEditHandlers = {
    previewScrollEditingId: string | null;
    onPreviewScrollEditStart: (request: PreviewScrollPointerEditRequest) => void;
    onPreviewScrollEditMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPreviewScrollEditEnd: (event: ReactPointerEvent<HTMLElement>) => void;
};
type PreviewAnchorPointerEditHandlers = {
    previewAnchorEditingId: number | null;
    onPreviewAnchorEditStart: (request: PreviewAnchorPointerEditRequest) => void;
    onPreviewAnchorEditMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPreviewAnchorEditEnd: (event: ReactPointerEvent<HTMLElement>) => void;
};
type PreviewCuePointerEditHandlers = {
    previewCueEditingId: number | null;
    onPreviewCueEditStart: (request: PreviewCuePointerEditRequest) => void;
    onPreviewCueEditMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPreviewCueEditEnd: (event: ReactPointerEvent<HTMLElement>) => void;
};
type VisualCutPointerEditRequest = {
    event: ReactPointerEvent<HTMLElement>;
    clip: VisualClip;
    index: number;
    mode: VisualCutEditMode;
};
type VisualCutPointerEditHandlers = {
    visualCutEditingId: string | null;
    onVisualCutEditStart: (request: VisualCutPointerEditRequest) => void;
    onVisualCutEditMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onVisualCutEditEnd: (event: ReactPointerEvent<HTMLElement>) => void;
};
type TrackCueListItem = {
    id: number;
    script: string;
    characterId?: number;
    trackId: number;
    audioId?: number;
    audio?: {
        id: number;
        audioType: AudioType;
        name: string;
        audioUrl: string;
        duration?: number;
    };
    startTime: number;
    endTime: number;
    audioStartTime?: number;
    audioEndTime?: number;
    startCanvasMediaId?: number;
    endCanvasMediaId?: number;
    startPosition: number;
    endPosition: number;
    volume: number;
};
type TrackScrollListItem = {
    id: number;
    trackId: number;
    startAnchorId: number;
    endAnchorId: number;
    canvasId?: number;
    startIndex: number;
    endIndex: number;
    startTime: number;
    endTime: number;
    startPosition: number;
    endPosition: number;
};
type TrackListItem = {
    id: number;
    episodeId: number;
    name: string;
    type: TrackApiType;
    characterId?: number;
    isMuted: boolean;
    cues?: TrackCueListItem[];
    scrolls?: TrackScrollListItem[];
};
type TrackListResponse = {
    data: {
        items: TrackListItem[];
        total: number;
    };
};
type CueListResponse = {
    data: {
        items: TrackCueListItem[];
        total: number;
    };
};
type DialogueCue = TrackCueListItem & {
    trackName: string;
};
type DialogueLine = {
    id: string;
    cueId: number;
    startTime: number;
    time: string;
    text: string;
    meta: string;
};
type CharacterListItem = {
    id: number;
    productId: string;
    name: string;
    role: CharacterRole;
    imageUrl?: string;
};
type CharacterListResponse = {
    data: {
        items: CharacterListItem[];
        total: number;
    };
};
type MediaListItem = {
    id: number;
    episodeId: number;
    mediaName: string;
    mediaType: MediaType;
    mediaUrl: string;
    duration?: number;
};
type MediaListResponse = {
    data: {
        items: MediaListItem[];
        total: number;
    };
};
type AudioListItem = {
    id: number;
    episodeId: number;
    cueId?: number;
    audioType: AudioType;
    name: string;
    audioUrl: string;
    duration?: number;
};
type AudioListResponse = {
    data: {
        items: AudioListItem[];
        total: number;
    };
};
type CanvasListMediaItem = {
    canvasMediaId?: number;
    mediaId: number;
    mediaName?: string;
    mediaType?: MediaType;
    mediaUrl?: string;
    duration?: number;
    index?: number;
    startTime?: number;
    endTime?: number;
    sourceStartTime?: number;
    sourceEndTime?: number;
    volume?: number;
    isMuted?: boolean;
};
type CanvasListItem = {
    id: number;
    episodeId: number;
    canvasMediaId?: number;
    mediaId?: number;
    mediaName?: string;
    mediaType?: MediaType;
    mediaUrl?: string;
    duration?: number;
    index?: number;
    startTime?: number;
    endTime?: number;
    sourceStartTime?: number;
    sourceEndTime?: number;
    volume?: number;
    isMuted?: boolean;
    medias?: CanvasListMediaItem[];
};
type CanvasListResponse = {
    data: {
        items: CanvasListItem[];
        total: number;
    };
};
type FileUploadUrlItem = {
    publicUrl: string;
    mimetype: string;
    presignedUrl: string;
};
type FileUploadUrlsResponse = {
    data: FileUploadUrlItem[];
};
type MediaUploadState = {
    status: 'idle' | 'uploading' | 'registering';
    fileName?: string;
    error?: string;
    failures?: MediaUploadFailure[];
};
type AudioUploadState = {
    status: 'idle' | 'extracting' | 'uploading' | 'registering';
    fileName?: string;
    error?: string;
};
type TimelineData = {
    audioTracks: AudioTrackDefinition[];
    timelineClips: TimelineClip[];
};
type TrackTimelineData = TimelineData & {
    scrollEvents: ScrollEventClip[];
};
type TrackFormType = Extract<TrackApiType, 'record' | 'audio' | 'bgm' | 'effect' | 'scroll'>;
type TrackCreateRequest = {
    name: string;
    type: TrackFormType;
    characterId?: number;
    isMuted?: boolean;
};
type CharacterCreateRequest = {
    name: string;
    role: CharacterRole;
    imageUrl?: string;
};
type AudioCreateRequest = {
    audioType: AudioType;
    name: string;
    audioUrl: string;
    duration?: number;
};
type AudioDropRequest = {
    trackId: number;
    startTime: number;
    endTime?: number;
    volume?: number;
};
type AudioDropResponse = {
    data: {
        track: {
            id: number;
            episodeId: number;
            name: string;
            type: TrackApiType;
            characterId?: number;
            isMuted: boolean;
        };
        cue: TrackCueListItem;
        audio: AudioListItem;
    };
};
type CanvasUpdateMediaRequest = {
    mediaId: number;
    index?: number;
    startTime?: number;
    endTime?: number;
    sourceStartTime?: number;
    sourceEndTime?: number;
    volume?: number;
    isMuted?: boolean;
};
type AnchorEvent =
    | {
          type: 'scroll';
          id: number;
          scrollId: number;
          startAnchorId: number;
          endAnchorId: number;
          canvasId?: number;
          startIndex?: number;
          endIndex?: number;
          startTime?: number;
          endTime?: number;
          startPosition?: number;
          endPosition?: number;
      }
    | {
          type: 'pause';
          id: number;
          pauseId: number;
          anchorId: number;
          duration: number;
          canvasId?: number;
          index?: number;
          time?: number;
          position?: number;
      };
type AnchorListItem = {
    id: number;
    trackId: number;
    canvasId: number;
    time: number;
    position: number;
    index: number;
    event: AnchorEvent | null;
};
type AnchorListResponse = {
    data: {
        items: AnchorListItem[];
        total: number;
    };
};
type AnchorEventDraft = {
    type: 'scroll' | 'pause';
    endAnchorId: string;
    duration: string;
    isSaving: boolean;
    error: string | null;
};
type AnchorEventMutationRequest = { type: 'scroll'; endAnchorId: number } | { type: 'pause'; duration: number };
type CharacterCreateDraft = {
    name: string;
    role: CharacterRole;
    imageUrl: string;
};
type CharacterCreatePanelState = {
    isOpen: boolean;
    isSaving: boolean;
    error: string | null;
    draft: CharacterCreateDraft;
};
type CueCreateRequest = {
    script: string;
    startTime?: number;
    endTime?: number;
    audioId?: number;
    audioStartTime?: number;
    audioEndTime?: number;
    startCanvasMediaId?: number;
    endCanvasMediaId?: number;
    startPosition?: number;
    endPosition?: number;
    volume?: number;
};
type CueUpdateRequest = Partial<CueCreateRequest>;
type CueSplitRequest = {
    splitTime: number;
};
type CueScriptPanelState = {
    draft: string;
    isSaving: boolean;
    error: string | null;
};
type TimelineTickKind = 'minor' | 'mid' | 'major';
type TimelineTick = {
    time: number;
    kind: TimelineTickKind;
};
type TimelineToolDefinition = {
    id: TimelineToolMode;
    label: string;
    key: string;
    icon: IconName;
};

const panelDefinitions: PanelDefinition[] = [
    {
        id: 'char',
        label: '캐릭터',
        icon: 'mic',
        title: '캐릭터 보이스',
        description: '등장인물별 목소리, 감정톤, 대사 분량을 관리합니다.',
    },
    {
        id: 'assets',
        label: '미디어',
        icon: 'image',
        title: '미디어',
        description: '세로 스크롤 이미지와 삽입 영상을 타임라인에 배치합니다.',
    },
    {
        id: 'audio',
        label: '오디오',
        icon: 'music',
        title: '오디오',
        description: 'BGM, 효과음, 나레이션 소스를 한 곳에서 확인합니다.',
    },
    {
        id: 'text',
        label: '대사',
        icon: 'text',
        title: '대사',
        description: '대사와 나레이션을 영상 자막으로 정리합니다.',
    },
    {
        id: 'fx',
        label: '효과',
        icon: 'effect',
        title: '특수효과',
        description: '컷과 대사 클립에 바로 얹을 수 있는 연출 프리셋입니다.',
    },
    {
        id: 'settings',
        label: '설정',
        icon: 'settings',
        title: '프로젝트 설정',
        description: '영상 비율, 내보내기 품질, 작업 기준을 조정합니다.',
    },
];
const timelineToolDefinitions: TimelineToolDefinition[] = [
    {
        id: 'select',
        label: '선택',
        key: 'A',
        icon: 'cursor',
    },
    {
        id: 'split',
        label: '자르기',
        key: 'B',
        icon: 'split',
    },
    {
        id: 'selectL',
        label: '왼쪽 선택',
        key: '[',
        icon: 'selectLeft',
    },
    {
        id: 'selectR',
        label: '오른쪽 선택',
        key: ']',
        icon: 'selectRight',
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

const effectById = new Map(effectLibrary.map((effect) => [effect.id, effect]));
const emptyTimelineData: TimelineData = {
    audioTracks: [],
    timelineClips: [],
};
const waveformBars = Array.from({ length: 24 }, (_, index) => 18 + ((index * 17) % 32));
const trackColorPalette = ['#5b9bff', '#2dd4bf', '#fbbf24', '#34d399', '#f472b6', '#a78bfa', '#93c5fd'];
const characterRoleLabels: Record<string, string> = {
    starring: '주연',
    supporting: '조연',
    minor: '단역',
    narrator: '나레이션',
    unknown: '역할 미정',
};
const characterRoleOptions: Array<{ value: CharacterRole; label: string }> = [
    { value: 'starring', label: '주연' },
    { value: 'supporting', label: '조연' },
    { value: 'minor', label: '단역' },
    { value: 'narrator', label: '나레이션' },
    { value: 'unknown', label: '역할 미정' },
];
const initialCharacterCreateDraft: CharacterCreateDraft = {
    name: '',
    role: 'starring',
    imageUrl: '',
};
const visualClipBackgrounds = [
    'linear-gradient(160deg,#22304f,#111827 62%,#263c2f)',
    'linear-gradient(160deg,#453456,#171421 62%,#3f2533)',
    'linear-gradient(160deg,#314f48,#0d1d1d 64%,#5d5430)',
    'linear-gradient(135deg,#67503a,#1a1410 60%,#423531)',
    'linear-gradient(150deg,#233d5f,#0f172a 65%,#182c3b)',
    'linear-gradient(160deg,#583c3c,#1f1616 60%,#604b2e)',
];

const iconPaths: Record<IconName, ReactNode> = {
    anchor: (
        <>
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </>
    ),
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
    selectLeft: (
        <>
            <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
            <path d="m16 9-3 3 3 3" />
            <path d="M20 12h-7" />
        </>
    ),
    selectRight: (
        <>
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
            <path d="m8 9 3 3-3 3" />
            <path d="M4 12h7" />
        </>
    ),
    settings: (
        <>
            <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7.1 4.4l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.9 7l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.7 1Z" />
        </>
    ),
    split: (
        <>
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M8.5 7.5 20 18" />
            <path d="M8.5 16.5 20 6" />
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

function formatEpisodeLabel(episodeNumber: number | undefined, episodeId: string) {
    const parsedEpisodeId = Number.parseInt(episodeId, 10);
    const resolvedEpisodeNumber =
        typeof episodeNumber === 'number' && Number.isFinite(episodeNumber) && episodeNumber > 0
            ? episodeNumber
            : parsedEpisodeId;

    if (!Number.isFinite(resolvedEpisodeNumber) || resolvedEpisodeNumber <= 0) {
        return 'EP';
    }

    return `EP.${Math.trunc(resolvedEpisodeNumber).toString().padStart(2, '0')}`;
}

function getTrackKindLabel(kind: TrackApiType) {
    if (kind === 'scroll' || kind === 'scrolls') return 'SCROLL';
    if (kind === 'record') return 'VOICE';
    if (kind === 'audio') return 'AUDIO';
    if (kind === 'bgm') return 'MUSIC';
    return 'SFX';
}

function getTrackKindIcon(kind: TrackApiType): IconName {
    if (kind === 'scroll' || kind === 'scrolls') return 'image';
    if (kind === 'record') return 'mic';
    if (kind === 'audio' || kind === 'bgm') return 'music';
    return 'wave';
}

function getAudioTypeLabel(audioType: AudioType) {
    if (audioType === 'bgm') return 'BGM';
    if (audioType === 'effect') return 'SFX';
    if (audioType === 'tts') return 'TTS';
    return 'AUDIO';
}

function formatAudioDuration(duration: number | undefined) {
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
        return '길이 미확인';
    }

    const totalSeconds = Math.max(0, Math.round(duration / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function isScrollTrackKind(kind: TrackApiType | undefined) {
    return kind === 'scroll' || kind === 'scrolls';
}

function toTimelineSeconds(time: number) {
    return time >= 1000 ? time / 1000 : time;
}

function toTimelineMilliseconds(seconds: number | undefined) {
    return typeof seconds === 'number' && Number.isFinite(seconds) ? Math.round(Math.max(0, seconds) * 1000) : undefined;
}

function toCanvasMediaSeconds(time: number | undefined) {
    return typeof time === 'number' && Number.isFinite(time) ? Math.max(0, time / 1000) : undefined;
}

function snapTimelineSeconds(time: number) {
    return Math.round(time / TIMELINE_SNAP_SECONDS) * TIMELINE_SNAP_SECONDS;
}

function getTimelineEditSeconds(time: number, isSnapEnabled: boolean) {
    return isSnapEnabled ? snapTimelineSeconds(time) : Number(time.toFixed(2));
}

function getPreviewCoordinateHeight(stripHeightPx: number) {
    return Math.max(1, Math.round(stripHeightPx));
}

function getPreviewCutHeight(visualClipCount: number, stripHeightPx = PREVIEW_SCROLL_STRIP_HEIGHT_PX) {
    if (visualClipCount <= 0) {
        return getPreviewCoordinateHeight(stripHeightPx);
    }

    return Math.max(PREVIEW_CUT_HEIGHT, Math.ceil(getPreviewCoordinateHeight(stripHeightPx) / visualClipCount));
}

function reflowVisualClips(clips: VisualClip[]) {
    let nextStart = 0;

    return clips.map((clip) => {
        const duration = Math.max(1, Number(clip.duration.toFixed(2)));
        const nextClip = {
            ...clip,
            start: Number(nextStart.toFixed(2)),
            duration,
        };

        nextStart += duration;
        return nextClip;
    });
}

function reflowVisualClipsForCanvas(clips: VisualClip[], canvasId: number) {
    let nextStart = 0;

    return clips.map((clip) => {
        if (clip.canvasId !== canvasId) {
            return clip;
        }

        const duration = Math.max(1, Number(clip.duration.toFixed(2)));
        const nextClip = {
            ...clip,
            start: Number(nextStart.toFixed(2)),
            duration,
        };

        nextStart += duration;
        return nextClip;
    });
}

function moveVisualClipWithinCanvas(clips: VisualClip[], clipId: string, targetIndex: number, canvasId: number) {
    const canvasClips = clips.filter((clip) => clip.canvasId === canvasId);
    const currentIndex = canvasClips.findIndex((clip) => clip.id === clipId);

    if (currentIndex < 0) {
        return clips;
    }

    const nextCanvasClips = [...canvasClips];
    const [movedClip] = nextCanvasClips.splice(currentIndex, 1);
    nextCanvasClips.splice(clamp(targetIndex, 0, nextCanvasClips.length), 0, movedClip);

    const queue = [...nextCanvasClips];
    const nextClips = clips.map((clip) => (clip.canvasId === canvasId ? queue.shift() ?? clip : clip));

    return reflowVisualClipsForCanvas(nextClips, canvasId);
}

function toggleIdInList(ids: string[], id: string) {
    return ids.includes(id) ? ids.filter((itemId) => itemId !== id) : [...ids, id];
}

function getCanvasMediaClipDurationSeconds(item: { mediaType: Exclude<MediaType, 'audio'>; duration?: number }) {
    if (item.mediaType === 'video' && typeof item.duration === 'number' && Number.isFinite(item.duration) && item.duration > 0) {
        return item.duration / 1000;
    }

    return CANVAS_MEDIA_SEQUENCE_UNIT_SECONDS;
}

function getVisualClipTimingLabel(clip: VisualClip) {
    if (clip.mediaType === 'video') {
        if (clip.hasTimelineControls) {
            return `타임라인 ${formatTime(clip.start)}-${formatTime(clip.start + clip.duration)}`;
        }

        return `영상 ${formatAudioDuration(clip.mediaDuration)}`;
    }

    return '앵커/이벤트 기준';
}

function getVideoTimelineClipMaxDurationSeconds(clip: VisualClip) {
    const sourceStart = typeof clip.sourceStart === 'number' && Number.isFinite(clip.sourceStart) ? clip.sourceStart : 0;

    if (typeof clip.sourceEnd === 'number' && Number.isFinite(clip.sourceEnd) && clip.sourceEnd > sourceStart) {
        return Math.max(MIN_TIMELINE_ITEM_DURATION_SECONDS, clip.sourceEnd - sourceStart);
    }

    if (typeof clip.mediaDuration === 'number' && Number.isFinite(clip.mediaDuration) && clip.mediaDuration > 0) {
        return Math.max(MIN_TIMELINE_ITEM_DURATION_SECONDS, clip.mediaDuration / 1000 - sourceStart);
    }

    return undefined;
}

function isTimelineTickMultiple(time: number, step: number) {
    return Math.abs(time / step - Math.round(time / step)) < 0.0001;
}

function getTimelineGridStep(pxPerSecond: number) {
    for (const seconds of TIMELINE_GRID_STEPS_SECONDS) {
        if (seconds * pxPerSecond >= MIN_TIMELINE_GRIDLINE_PX) {
            return seconds;
        }
    }

    return TIMELINE_GRID_STEPS_SECONDS[TIMELINE_GRID_STEPS_SECONDS.length - 1];
}

function getTimelineMinorTickStep(gridStep: number) {
    if (gridStep <= 1) return 0.25;
    if (gridStep <= 2) return 0.5;
    if (gridStep <= 5) return 1;
    if (gridStep <= 10) return 2;
    if (gridStep <= 30) return 5;
    if (gridStep <= 60) return 10;
    return 30;
}

function getTimelineLabelStep(gridStep: number) {
    if (gridStep <= 1) return 5;
    if (gridStep <= 2) return 10;
    if (gridStep <= 5) return 30;
    if (gridStep <= 10) return 60;
    if (gridStep <= 60) return 120;
    return 120;
}

function formatTimelineGridStep(seconds: number) {
    if (seconds >= 60) {
        return `${seconds / 60}분`;
    }

    return `${seconds}초`;
}

function getTimelineTicks(durationSeconds: number, pxPerSecond: number): TimelineTick[] {
    const gridStep = getTimelineGridStep(pxPerSecond);
    const minorStep = getTimelineMinorTickStep(gridStep);
    const labelStep = getTimelineLabelStep(gridStep);
    const ticks: TimelineTick[] = [];

    for (let time = 0; time <= durationSeconds + 0.0001; time = Number((time + minorStep).toFixed(3))) {
        let kind: TimelineTickKind = 'minor';

        if (isTimelineTickMultiple(time, labelStep)) {
            kind = 'major';
        } else if (isTimelineTickMultiple(time, gridStep)) {
            kind = 'mid';
        }

        ticks.push({ time, kind });
    }

    return ticks;
}

function getTimelinePointerSeconds(target: HTMLElement, clientX: number, pxPerSecond: number, maxSeconds: number) {
    const timelineScroll = target.closest('.odx-timeline-scroll');

    if (!(timelineScroll instanceof HTMLElement)) {
        return 0;
    }

    const rect = timelineScroll.getBoundingClientRect();
    const x = clientX - rect.left + timelineScroll.scrollLeft;

    return clamp(x / pxPerSecond, 0, maxSeconds);
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

function getCharacterInitial(name: string) {
    return Array.from(name.trim())[0] ?? '?';
}

function getCharacterRoleLabel(role: string) {
    return characterRoleLabels[role] ?? role;
}

function toCharacterDefinitions(items: CharacterListItem[]): CharacterDefinition[] {
    return items.map((item, index) => ({
        id: String(item.id),
        name: item.name,
        role: getCharacterRoleLabel(item.role),
        color: trackColorPalette[index % trackColorPalette.length],
        initial: getCharacterInitial(item.name),
        meta: `ID ${item.id}`,
        imageUrl: item.imageUrl,
    }));
}

function isVisualClipId(id: string) {
    return id.startsWith('canvas-') || id.startsWith('media-');
}

function toVisualClips(items: CanvasListItem[]): VisualClip[] {
    const visualItems: Array<{
        canvasId: number;
        canvasMediaId?: number;
        clipId: string;
        mediaId: number;
        mediaName?: string;
        mediaType: Exclude<MediaType, 'audio'>;
        mediaUrl: string;
        duration?: number;
        index?: number;
        startTime?: number;
        endTime?: number;
        sourceStartTime?: number;
        sourceEndTime?: number;
        volume?: number;
        isMuted?: boolean;
    }> = [];

    items.forEach((item) => {
        const medias =
            item.medias && item.medias.length > 0
                ? item.medias
                : [
                      {
                          canvasMediaId: item.canvasMediaId,
                          mediaId: item.mediaId,
                          mediaName: item.mediaName,
                          mediaType: item.mediaType,
                          mediaUrl: item.mediaUrl,
                          duration: item.duration,
                          index: item.index,
                          startTime: item.startTime,
                          endTime: item.endTime,
                          sourceStartTime: item.sourceStartTime,
                          sourceEndTime: item.sourceEndTime,
                          volume: item.volume,
                          isMuted: item.isMuted,
                      },
                  ];

        medias.forEach((media) => {
            if (
                typeof media.mediaId !== 'number' ||
                typeof media.mediaUrl !== 'string' ||
                (media.mediaType !== 'image' && media.mediaType !== 'video')
            ) {
                return;
            }

            visualItems.push({
                canvasId: item.id,
                canvasMediaId: media.canvasMediaId,
                clipId:
                    item.medias && item.medias.length > 1
                        ? `canvas-${item.id}-media-${media.mediaId}`
                        : `canvas-${item.id}`,
                mediaId: media.mediaId,
                mediaName: media.mediaName,
                mediaType: media.mediaType,
                mediaUrl: media.mediaUrl,
                duration: media.duration,
                index: media.index,
                startTime: media.startTime,
                endTime: media.endTime,
                sourceStartTime: media.sourceStartTime,
                sourceEndTime: media.sourceEndTime,
                volume: media.volume,
                isMuted: media.isMuted,
            });
        });
    });

    visualItems.sort(
        (a, b) =>
            (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER) ||
            a.canvasId - b.canvasId ||
            a.mediaId - b.mediaId,
    );

    let nextStart = 0;

    return visualItems.map((item, index) => {
        const explicitStart = toCanvasMediaSeconds(item.startTime);
        const explicitEnd = toCanvasMediaSeconds(item.endTime);
        const hasTimelineControls =
            item.mediaType === 'video' &&
            typeof explicitStart === 'number' &&
            typeof explicitEnd === 'number' &&
            explicitEnd > explicitStart;
        const duration = hasTimelineControls
            ? Math.max(MIN_TIMELINE_ITEM_DURATION_SECONDS, explicitEnd - explicitStart)
            : getCanvasMediaClipDurationSeconds(item);
        const start = hasTimelineControls ? explicitStart : nextStart;
        const clip = {
            id: item.clipId,
            canvasId: item.canvasId,
            canvasMediaId: item.canvasMediaId,
            index: item.index,
            mediaId: item.mediaId,
            mediaDuration: item.duration,
            hasTimelineControls,
            sourceStart: toCanvasMediaSeconds(item.sourceStartTime),
            sourceEnd: toCanvasMediaSeconds(item.sourceEndTime),
            volume: item.volume,
            isMuted: item.isMuted,
            kind: item.mediaType === 'video' ? 'video' : 'cut',
            start: Number(start.toFixed(2)),
            duration: Number(duration.toFixed(2)),
            label: item.mediaName?.trim() || `${item.mediaType === 'video' ? '영상' : '이미지'} ${String(index + 1).padStart(2, '0')}`,
            description: item.mediaType === 'video' ? '스트립에 등록된 영상 미디어' : '스트립에 등록된 이미지 미디어',
            background: visualClipBackgrounds[index % visualClipBackgrounds.length],
            mediaUrl: item.mediaUrl,
            mediaType: item.mediaType,
        } satisfies VisualClip;

        nextStart = Math.max(nextStart, start + duration);
        return clip;
    });
}

function toImageCompositionSources(clips: VisualClip[]): ImageCompositionSource[] {
    return clips
        .filter(
            (clip): clip is VisualClip & { mediaUrl: string; mediaType: Exclude<MediaType, 'audio'> } =>
                (clip.mediaType === 'image' || clip.mediaType === 'video') && typeof clip.mediaUrl === 'string',
        )
        .map((clip, index) => ({
            clipId: clip.id,
            canvasId: clip.canvasId,
            mediaId: clip.mediaId,
            mediaType: clip.mediaType,
            label: clip.label,
            mediaUrl: clip.mediaUrl,
            order: index,
            ...(clip.hasTimelineControls
                ? {
                      startTime: toTimelineMilliseconds(clip.start),
                      endTime: toTimelineMilliseconds(clip.start + clip.duration),
                  }
                : {}),
            ...(typeof clip.sourceStart === 'number' ? { sourceStartTime: toTimelineMilliseconds(clip.sourceStart) } : {}),
            ...(typeof clip.sourceEnd === 'number' ? { sourceEndTime: toTimelineMilliseconds(clip.sourceEnd) } : {}),
            ...(typeof clip.volume === 'number' ? { volume: clip.volume } : {}),
            ...(typeof clip.isMuted === 'boolean' ? { isMuted: clip.isMuted } : {}),
        }));
}

function toCanvasUpdateMediasFromVisualClips(clips: VisualClip[], canvasId: number): CanvasUpdateMediaRequest[] {
    return clips
        .filter((clip) => clip.canvasId === canvasId)
        .sort(
            (a, b) =>
                (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER) ||
                a.mediaId - b.mediaId,
        )
        .map((clip, index) => ({
            mediaId: clip.mediaId,
            index,
            ...(clip.mediaType === 'video' && clip.hasTimelineControls
                ? {
                      startTime: toTimelineMilliseconds(clip.start),
                      endTime: toTimelineMilliseconds(clip.start + clip.duration),
                  }
                : {}),
            ...(clip.mediaType === 'video' && typeof clip.sourceStart === 'number'
                ? { sourceStartTime: toTimelineMilliseconds(clip.sourceStart) }
                : {}),
            ...(clip.mediaType === 'video' && typeof clip.sourceEnd === 'number'
                ? { sourceEndTime: toTimelineMilliseconds(clip.sourceEnd) }
                : {}),
            ...(clip.mediaType === 'video' && typeof clip.volume === 'number' ? { volume: clip.volume } : {}),
            ...(clip.mediaType === 'video' && typeof clip.isMuted === 'boolean' ? { isMuted: clip.isMuted } : {}),
        }));
}

function getCanvasMediaCount(item: CanvasListItem) {
    if (item.medias) {
        return item.medias.length;
    }

    return typeof item.mediaId === 'number' ? 1 : 0;
}

function toCutEditCanvasSummaries(items: CanvasListItem[], clips: VisualClip[]): CutEditCanvasSummary[] {
    const clipsByCanvasId = new Map<number, VisualClip[]>();

    clips.forEach((clip) => {
        if (typeof clip.canvasId !== 'number') {
            return;
        }

        clipsByCanvasId.set(clip.canvasId, [...(clipsByCanvasId.get(clip.canvasId) ?? []), clip]);
    });

    const seenCanvasIds = new Set(items.map((item) => item.id));
    const summaries = items.map((item, index) => {
        const layerCount = getCanvasMediaCount(item);
        const canvasClips = clipsByCanvasId.get(item.id) ?? [];

        return {
            id: item.id,
            label: `캔버스 ${String(index + 1).padStart(2, '0')}`,
            sublabel: `ID ${item.id} · ${layerCount}개 레이어`,
            layerCount,
            clips: canvasClips,
        };
    });

    clipsByCanvasId.forEach((canvasClips, canvasId) => {
        if (seenCanvasIds.has(canvasId)) {
            return;
        }

        summaries.push({
            id: canvasId,
            label: `캔버스 ${canvasId}`,
            sublabel: `ID ${canvasId} · ${canvasClips.length}개 레이어`,
            layerCount: canvasClips.length,
            clips: canvasClips,
        });
    });

    return summaries;
}

function getDroppedMediaClipId(mediaId: number, clips: VisualClip[], canvasId?: number) {
    const baseId = typeof canvasId === 'number' ? `canvas-${canvasId}-media-${mediaId}` : `media-${mediaId}`;

    if (!clips.some((clip) => clip.id === baseId)) {
        return baseId;
    }

    let suffix = 2;
    while (clips.some((clip) => clip.id === `${baseId}-${suffix}`)) {
        suffix += 1;
    }

    return `${baseId}-${suffix}`;
}

function toDroppedMediaVisualClip(media: MediaListItem, clips: VisualClip[], canvasId?: number): VisualClip | null {
    if (media.mediaType === 'audio') {
        return null;
    }

    const targetClips = typeof canvasId === 'number' ? clips.filter((clip) => clip.canvasId === canvasId) : clips;
    const index = targetClips.length;
    const label = media.mediaName?.trim() || `${getMediaTypeLabel(media.mediaType)} ${String(index + 1).padStart(2, '0')}`;
    const start = targetClips.reduce((maxEnd, clip) => Math.max(maxEnd, clip.start + clip.duration), 0);
    const duration = getCanvasMediaClipDurationSeconds({ mediaType: media.mediaType, duration: media.duration });

    return {
        id: getDroppedMediaClipId(media.id, clips, canvasId),
        canvasId,
        index,
        mediaId: media.id,
        mediaDuration: media.duration,
        kind: media.mediaType === 'video' ? 'video' : 'cut',
        start: Number(start.toFixed(2)),
        duration: Number(duration.toFixed(2)),
        label,
        description: media.mediaType === 'video' ? '미디어 탭에서 드롭한 영상 미디어' : '미디어 탭에서 드롭한 이미지 미디어',
        background: visualClipBackgrounds[index % visualClipBackgrounds.length],
        mediaUrl: media.mediaUrl,
        mediaType: media.mediaType,
    };
}

function getMediaTypeFromFile(file: File): Exclude<MediaType, 'audio'> | null {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';

    const extension = file.name.split('.').filter(Boolean).pop()?.toLowerCase();

    if (extension && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(extension)) return 'image';
    if (extension && ['mp4', 'mov', 'webm', 'm4v'].includes(extension)) return 'video';

    return null;
}

function getMediaUploadKey(episodeId: string, file: File, mediaType: Exclude<MediaType, 'audio'>) {
    const extension = file.name.split('.').filter(Boolean).pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const fallbackExtension = mediaType === 'video' ? 'mp4' : 'png';
    const safeExtension = extension || fallbackExtension;

    return `episodes/${episodeId}/medias/${mediaType}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
}

function getAudioUploadKey(episodeId: string, file: File, audioType: AudioType) {
    const extension = file.name.split('.').filter(Boolean).pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const safeExtension = extension || 'mp3';

    return `episodes/${episodeId}/audios/${audioType}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
}

function toTimelineData(tracks: TrackListItem[]): TrackTimelineData {
    const cueTracks = tracks.filter((track) => !isScrollTrackKind(track.type));

    return {
        audioTracks: tracks.map((track, index) => ({
            id: String(track.id),
            label: track.name,
            sublabel: getTrackKindLabel(track.type),
            icon: getTrackKindIcon(track.type),
            kind: track.type,
            characterId: typeof track.characterId === 'number' ? String(track.characterId) : undefined,
            color: track.type === 'record' ? trackColorPalette[index % trackColorPalette.length] : undefined,
        })),
        timelineClips: cueTracks.flatMap((track) =>
            [...(track.cues ?? [])]
                .sort((a, b) => a.startTime - b.startTime || a.id - b.id)
                .map((cue) => {
                    const start = toTimelineSeconds(cue.startTime);
                    const end = toTimelineSeconds(cue.endTime);
                    const cueTrackId = resolveCueTimelineTrackId({
                        parentTrackId: track.id,
                        cueTrackId: cue.trackId,
                    });

                    return {
                        id: `cue-${cue.id}`,
                        track: cueTrackId,
                        start,
                        duration: Math.max(end - start, 0.2),
                        label: cue.script || cue.audio?.name || '오디오',
                        sublabel: cue.audioId
                            ? `audio ${cue.audioId} · vol ${cue.volume}`
                            : `pos ${Math.round(cue.startPosition)}% · vol ${cue.volume}`,
                        audioId: cue.audioId,
                        audioUrl: cue.audio?.audioUrl,
                        audioStart: typeof cue.audioStartTime === 'number' ? toTimelineSeconds(cue.audioStartTime) : undefined,
                        audioEnd: typeof cue.audioEndTime === 'number' ? toTimelineSeconds(cue.audioEndTime) : undefined,
                        audioDuration: typeof cue.audio?.duration === 'number' ? toTimelineSeconds(cue.audio.duration) : undefined,
                        characterId: typeof cue.characterId === 'number' ? String(cue.characterId) : undefined,
                        volume: cue.volume,
                        startCanvasMediaId: cue.startCanvasMediaId,
                        endCanvasMediaId: cue.endCanvasMediaId,
                        startPosition: cue.startPosition,
                        endPosition: cue.endPosition,
                    };
                }),
        ),
        scrollEvents: tracks.flatMap((track) =>
            [...(track.scrolls ?? [])]
                .sort((a, b) => a.startTime - b.startTime || a.id - b.id)
                .map((scroll, index) => {
                    const start = toTimelineSeconds(scroll.startTime);
                    const end = toTimelineSeconds(scroll.endTime);

                    return {
                        id: `scroll-${scroll.id}`,
                        scrollId: scroll.id,
                        startAnchorId: scroll.startAnchorId,
                        endAnchorId: scroll.endAnchorId,
                        canvasId: scroll.canvasId,
                        startIndex: scroll.startIndex,
                        endIndex: scroll.endIndex,
                        track: String(track.id),
                        start,
                        duration: Math.max(end - start, MIN_TIMELINE_ITEM_DURATION_SECONDS),
                        label: `${track.name} ${index + 1}`,
                        sublabel: formatScrollRangeLabel(scroll.startIndex, scroll.startPosition, scroll.endIndex, scroll.endPosition),
                        startPosition: scroll.startPosition,
                        endPosition: scroll.endPosition,
                    } satisfies ScrollEventClip;
                }),
        ),
    };
}

function toCutEditCueTracks(tracks: TrackListItem[], audioTracks: AudioTrackDefinition[]): CutEditCueTrack[] {
    const trackDefinitionById = new Map(audioTracks.map((track) => [track.id, track]));
    const cueTrackById = new Map(
        tracks
            .filter((track) => !isScrollTrackKind(track.type) && typeof track.characterId === 'number')
            .map((track) => {
                const trackDefinition = trackDefinitionById.get(String(track.id));

                return [
                    String(track.id),
                    {
                        id: String(track.id),
                        label: trackDefinition?.label ?? track.name,
                        color: trackDefinition?.color,
                        cues: [] as TrackCueListItem[],
                    },
                ] as const;
            }),
    );
    const seenCueIds = new Set<number>();

    tracks.forEach((track) => {
        (track.cues ?? []).forEach((cue) => {
            if (seenCueIds.has(cue.id)) {
                return;
            }

            const cueTrack = cueTrackById.get(
                resolveCueTimelineTrackId({
                    parentTrackId: track.id,
                    cueTrackId: cue.trackId,
                }),
            );

            if (!cueTrack) {
                return;
            }

            cueTrack.cues.push(cue);
            seenCueIds.add(cue.id);
        });
    });

    return [...cueTrackById.values()].map((track) => ({
        ...track,
        cues: [...track.cues].sort((a, b) => a.startPosition - b.startPosition || a.id - b.id),
    }));
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

async function listTrackCues(apiBaseUrl: string, trackId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/cues`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Cue list failed: ${response.status}`);
    }

    const result = (await response.json()) as CueListResponse;
    return result.data.items;
}

async function createTrack(apiBaseUrl: string, episodeId: string, track: TrackCreateRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/tracks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(track),
    });

    if (!response.ok) {
        throw new Error(`Track create failed: ${response.status}`);
    }
}

async function deleteTrack(apiBaseUrl: string, episodeId: string, trackId: string) {
    const target = toTrackMutationTarget({ episodeId, trackId });

    if (!target) {
        throw new Error('Track delete target is invalid');
    }

    const response = await fetch(getTrackDeleteUrl(apiBaseUrl, target), {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Track delete failed: ${response.status}`);
    }
}

async function createCue(apiBaseUrl: string, trackId: string, cue: CueCreateRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/cues`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(cue),
    });

    if (!response.ok) {
        throw new Error(`Cue create failed: ${response.status}`);
    }
}

async function updateCue(apiBaseUrl: string, trackId: string, cueId: string, cue: CueUpdateRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/cues/${cueId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(cue),
    });

    if (!response.ok) {
        throw new Error(`Cue update failed: ${response.status}`);
    }
}

async function splitCue(apiBaseUrl: string, trackId: string, cueId: string, request: CueSplitRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/cues/${cueId}/split`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        throw new Error(`Cue split failed: ${response.status}`);
    }
}

async function deleteCue(apiBaseUrl: string, trackId: string, cueId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/cues/${cueId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Cue delete failed: ${response.status}`);
    }
}

async function listAnchors(apiBaseUrl: string, trackId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/anchors`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Anchor list failed: ${response.status}`);
    }

    const result = (await response.json()) as AnchorListResponse;
    return result.data.items.map((anchor) => ({ ...anchor, event: anchor.event ?? null }));
}

async function listAnchorsForTracks(apiBaseUrl: string, trackIds: string[]) {
    if (trackIds.length === 0) {
        return [];
    }

    const anchorGroups = await Promise.all(trackIds.map((trackId) => listAnchors(apiBaseUrl, trackId)));

    return anchorGroups.flat().sort((a, b) => a.time - b.time || a.id - b.id);
}

function getAnchorSelectionId(anchorId: number) {
    return `anchor-${anchorId}`;
}

function toAnchorSelection(anchor: AnchorListItem): AnchorSelection {
    return {
        id: getAnchorSelectionId(anchor.id),
        anchorId: anchor.id,
        trackId: String(anchor.trackId),
        canvasId: anchor.canvasId,
        time: anchor.time,
        position: anchor.position,
        index: anchor.index,
        event: anchor.event ?? null,
        label: `앵커 A${anchor.id}`,
        sublabel: `${formatTime(toTimelineSeconds(anchor.time))} · ${formatScrollIndexedPosition(anchor.index, anchor.position)}`,
    };
}

function sortAnchors(anchors: AnchorListItem[]) {
    return [...anchors].sort((a, b) => a.time - b.time || a.id - b.id);
}

function applyAnchorMutation(anchor: AnchorListItem, request: ScrollAnchorMutationRequest): AnchorListItem {
    return {
        ...anchor,
        canvasId: request.canvasId,
        time: request.time,
        position: request.position,
        index: request.index,
    };
}

function replaceAnchor(anchors: AnchorListItem[], nextAnchor: AnchorListItem) {
    return sortAnchors(anchors.map((anchor) => (anchor.id === nextAnchor.id ? nextAnchor : anchor)));
}

function applyCuePositionMutation(cue: TrackCueListItem, request: CueStripPositionRequest): TrackCueListItem {
    return {
        ...cue,
        startCanvasMediaId: request.startCanvasMediaId,
        endCanvasMediaId: request.endCanvasMediaId,
        startPosition: request.startPosition,
        endPosition: request.endPosition,
    };
}

function replaceCueInTracks(tracks: TrackListItem[], trackId: string, nextCue: TrackCueListItem) {
    return tracks.map((track) =>
        String(track.id) === trackId || (track.cues ?? []).some((cue) => cue.id === nextCue.id)
            ? {
                  ...track,
                  cues: (track.cues ?? []).map((cue) => (cue.id === nextCue.id ? nextCue : cue)),
              }
            : track,
    );
}

function replaceCuePositionInTimelineData(
    timelineData: TimelineData,
    cue: TrackCueListItem,
    request: CueStripPositionRequest,
) {
    const cueId = `cue-${cue.id}`;

    return {
        ...timelineData,
        timelineClips: timelineData.timelineClips.map((clip) =>
            clip.id === cueId
                ? {
                      ...clip,
                      startCanvasMediaId: request.startCanvasMediaId,
                      endCanvasMediaId: request.endCanvasMediaId,
                      startPosition: request.startPosition,
                      endPosition: request.endPosition,
                      sublabel: clip.audioId
                          ? `audio ${clip.audioId} · pos ${Math.round(request.startPosition)}% · vol ${clip.volume ?? cue.volume}`
                          : `pos ${Math.round(request.startPosition)}% · vol ${clip.volume ?? cue.volume}`,
                  }
                : clip,
        ),
    };
}

function findMatchingAnchor(anchors: AnchorListItem[], request: ScrollAnchorMutationRequest) {
    return [...anchors]
        .reverse()
        .find(
            (anchor) =>
                anchor.canvasId === request.canvasId &&
                anchor.time === request.time &&
                anchor.position === request.position &&
                anchor.index === request.index,
        );
}

async function createAnchor(apiBaseUrl: string, trackId: string, anchor: ScrollAnchorMutationRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/anchors`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(anchor),
    });

    if (!response.ok) {
        throw new Error(`Anchor create failed: ${response.status}`);
    }

    const anchors = await listAnchors(apiBaseUrl, trackId);
    const createdAnchor = findMatchingAnchor(anchors, anchor);

    if (!createdAnchor) {
        throw new Error('Created anchor was not found.');
    }

    return createdAnchor;
}

async function updateAnchor(apiBaseUrl: string, trackId: string, anchorId: number, anchor: ScrollAnchorMutationRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/anchors/${anchorId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(anchor),
    });

    if (!response.ok) {
        throw new Error(`Anchor update failed: ${response.status}`);
    }
}

async function deleteAnchor(apiBaseUrl: string, trackId: string, anchorId: number) {
    const target = toAnchorMutationTarget({ trackId, anchorId });

    if (!target) {
        throw new Error('Anchor delete target is invalid');
    }

    const response = await fetch(getAnchorDeleteUrl(apiBaseUrl, target), {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Anchor delete failed: ${response.status}`);
    }
}

async function upsertAnchorEvent(apiBaseUrl: string, trackId: string, anchorId: number, request: AnchorEventMutationRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/anchors/${anchorId}/event`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        throw new Error(`Anchor event save failed: ${response.status}`);
    }
}

async function deleteAnchorEvent(apiBaseUrl: string, trackId: string, anchorId: number) {
    const target = toAnchorMutationTarget({ trackId, anchorId });

    if (!target) {
        throw new Error('Anchor event delete target is invalid');
    }

    const response = await fetch(getAnchorEventDeleteUrl(apiBaseUrl, target), {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Anchor event delete failed: ${response.status}`);
    }
}

async function createScrollEvent(apiBaseUrl: string, trackId: string, scroll: ScrollEventMutationRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/scrolls`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(scroll),
    });

    if (!response.ok) {
        throw new Error(`Scroll create failed: ${response.status}`);
    }
}

async function updateScrollEvent(apiBaseUrl: string, trackId: string, scrollId: number, scroll: ScrollEventMutationRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/scrolls/${scrollId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(scroll),
    });

    if (!response.ok) {
        throw new Error(`Scroll update failed: ${response.status}`);
    }
}

async function deleteScrollEvent(apiBaseUrl: string, trackId: string, scrollId: number) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/scrolls/${scrollId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Scroll delete failed: ${response.status}`);
    }
}

async function listCharacters(apiBaseUrl: string, productId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/products/${productId}/characters`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Character list failed: ${response.status}`);
    }

    const result = (await response.json()) as CharacterListResponse;
    return result.data.items;
}

async function createCharacter(apiBaseUrl: string, productId: string, character: CharacterCreateRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/products/${productId}/characters`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(character),
    });

    if (!response.ok) {
        throw new Error(`Character create failed: ${response.status}`);
    }
}

async function listMedias(apiBaseUrl: string, episodeId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/medias`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Media list failed: ${response.status}`);
    }

    const result = (await response.json()) as MediaListResponse;
    return result.data.items;
}

async function listAudios(apiBaseUrl: string, episodeId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/audios`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Audio list failed: ${response.status}`);
    }

    const result = (await response.json()) as AudioListResponse;
    return result.data.items;
}

async function listCanvases(apiBaseUrl: string, episodeId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/canvases`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Canvas list failed: ${response.status}`);
    }

    const result = (await response.json()) as CanvasListResponse;
    return result.data.items;
}

async function getFileUploadUrls(apiBaseUrl: string, files: FileUploadUrlRequest[]) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/files/uploadUrls`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files }),
    });

    if (!response.ok) {
        throw new Error(`File upload URL request failed: ${response.status}`);
    }

    const result = (await response.json()) as FileUploadUrlsResponse;
    return result.data;
}

async function createMedia(
    apiBaseUrl: string,
    episodeId: string,
    media: { mediaName: string; mediaType: Exclude<MediaType, 'audio'>; mediaUrl: string; duration?: number }
) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/medias`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(media),
    });

    if (!response.ok) {
        throw new Error(`Media create failed: ${response.status}`);
    }
}

async function updateCanvas(
    apiBaseUrl: string,
    episodeId: string,
    canvasId: number,
    canvas: { medias: Array<ImageCompositionCanvasMedia | CanvasUpdateMediaRequest> },
) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/canvases/${canvasId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(canvas),
    });

    if (!response.ok) {
        throw new Error(`Canvas update failed: ${response.status}`);
    }
}

async function createAudio(apiBaseUrl: string, episodeId: string, audio: AudioCreateRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/audios`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(audio),
    });

    if (!response.ok) {
        throw new Error(`Audio create failed: ${response.status}`);
    }
}

async function dropAudioOnTrack(apiBaseUrl: string, episodeId: string, audioId: number, request: AudioDropRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/audios/${audioId}/drop-to-track`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        throw new Error(`Audio drop failed: ${response.status}`);
    }

    return (await response.json()) as AudioDropResponse;
}

async function deleteMedia(apiBaseUrl: string, episodeId: string, mediaId: number) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/medias/${mediaId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Media delete failed: ${response.status}`);
    }
}

function getItemEffects(item: Selection | undefined, overrides: Record<string, EffectId[]>) {
    if (!item) {
        return [];
    }

    return overrides[item.id] ?? ('effects' in item ? item.effects : undefined) ?? [];
}

function isTimelineClip(item: Selection): item is TimelineClip {
    return 'track' in item;
}

function isScrollEventClip(item: Selection): item is ScrollEventClip {
    return isTimelineClip(item) && item.id.startsWith('scroll-');
}

function isAnchorSelection(item: Selection): item is AnchorSelection {
    return 'anchorId' in item;
}

function getItemTypeLabel(item: Selection | undefined, trackById: Map<string, AudioTrackDefinition>) {
    if (!item) {
        return '선택 없음';
    }

    if (isAnchorSelection(item)) {
        return 'ANCHOR';
    }

    if (isTimelineClip(item)) {
        if (isScrollEventClip(item)) {
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
    anchorBySelectionId: Map<string, AnchorSelection>,
) {
    return visualClipById.get(selectedId) ?? audioClipById.get(selectedId) ?? scrollEventById.get(selectedId) ?? anchorBySelectionId.get(selectedId);
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

function getVisualClipStyle(clip: VisualClip): CSSProperties {
    return { background: clip.background };
}

function getVisualClipThumbStyle(clip: VisualClip): CSSProperties {
    if (clip.mediaType === 'image' && clip.mediaUrl) {
        return {
            backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.28)), url(${JSON.stringify(clip.mediaUrl)})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
        };
    }

    return { background: clip.background };
}

function getMediaTypeLabel(mediaType: MediaType) {
    if (mediaType === 'image') return '이미지';
    if (mediaType === 'video') return '영상';
    return '오디오';
}

function getMediaThumbStyle(media: MediaListItem, fallbackIndex: number): CSSProperties {
    if (media.mediaType === 'image' && media.mediaUrl) {
        return {
            backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.28)), url(${JSON.stringify(media.mediaUrl)})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
        };
    }

    return { background: visualClipBackgrounds[fallbackIndex % visualClipBackgrounds.length] };
}

function getPreviewPlayheadPixel(
    playhead: number,
    scrollEvents: PreviewScrollPositionEvent[],
    stripHeightPx: number,
    visualSegments: PreviewScrollVisualSegment[],
) {
    return getPreviewScrollPosition({ playhead, scrollEvents, stripHeightPx, visualSegments });
}

function getScrollEventStartPixel(event: ScrollEventClip, stripHeightPx: number, visualSegments: PreviewScrollVisualSegment[]) {
    return getPreviewScrollPixel({
        canvasId: event.canvasId,
        index: event.startIndex,
        position: event.startPosition,
        stripHeightPx,
        visualSegments,
    });
}

function getScrollEventEndPixel(event: ScrollEventClip, stripHeightPx: number, visualSegments: PreviewScrollVisualSegment[]) {
    return getPreviewScrollPixel({
        canvasId: event.canvasId,
        index: event.endIndex,
        position: event.endPosition,
        stripHeightPx,
        visualSegments,
    });
}

function getPreviewScrollEventStyle(event: ScrollEventClip, stripHeightPx: number, visualSegments: PreviewScrollVisualSegment[]): CSSProperties {
    const startPx = getScrollEventStartPixel(event, stripHeightPx, visualSegments);
    const endPx = getScrollEventEndPixel(event, stripHeightPx, visualSegments);

    return {
        top: `${Math.min(startPx, endPx)}px`,
        height: `${Math.max(34, Math.abs(endPx - startPx))}px`,
    };
}

function getPreviewScrollHandleStyle(pixel: number): CSSProperties {
    return {
        top: `${pixel}px`,
    };
}

function getPreviewScrollBandStyle(event: ScrollEventClip, stripHeightPx: number, visualSegments: PreviewScrollVisualSegment[]): CSSProperties {
    const startPx = getScrollEventStartPixel(event, stripHeightPx, visualSegments);
    const endPx = getScrollEventEndPixel(event, stripHeightPx, visualSegments);

    return {
        top: `${Math.min(startPx, endPx)}px`,
        height: `${Math.max(2, Math.abs(endPx - startPx))}px`,
    };
}

function getPreviewCutStyle(clip: VisualClip, visualClipCount: number, stripHeightPx = PREVIEW_SCROLL_STRIP_HEIGHT_PX): CSSProperties {
    return {
        ...getVisualClipStyle(clip),
        ...(clip.mediaUrl ? {} : { minHeight: `${getPreviewCutHeight(visualClipCount, stripHeightPx)}px` }),
    };
}

function formatScrollIndexedPosition(index: number | undefined, position: number) {
    const positionLabel = `${Math.round(position)}%`;

    if (typeof index !== 'number') {
        return positionLabel;
    }

    return `${index + 1}번째 · ${positionLabel}`;
}

function formatCueMediaPosition(canvasMediaId: number | undefined, position: number | undefined) {
    const positionLabel = typeof position === 'number' ? `${Math.round(position)}%` : '-';

    if (typeof canvasMediaId !== 'number') {
        return positionLabel;
    }

    return `미디어 ${canvasMediaId} · ${positionLabel}`;
}

function formatScrollRangeLabel(startIndex: number | undefined, startPosition: number, endIndex: number | undefined, endPosition: number) {
    return `${formatScrollIndexedPosition(startIndex, startPosition)} -> ${formatScrollIndexedPosition(endIndex, endPosition)}`;
}

function applyScrollAnchorToEvent(event: ScrollEventClip, edge: 'start' | 'end', anchor: PreviewScrollAnchor): ScrollEventClip {
    if (edge === 'start') {
        return {
            ...event,
            canvasId: typeof anchor.canvasId === 'number' ? anchor.canvasId : event.canvasId,
            startIndex: anchor.index,
            startPosition: anchor.position,
        };
    }

    return {
        ...event,
        endIndex: anchor.index,
        endPosition: anchor.position,
    };
}

function toPreviewPlaybackScrollEvents(scrollEvents: ScrollEventClip[], anchors: AnchorListItem[]): PreviewScrollPositionEvent[] {
    const pauseEvents = anchors.flatMap((anchor): PreviewScrollPositionEvent[] => {
        if (anchor.event?.type !== 'pause') {
            return [];
        }

        return [
            {
                start: toTimelineSeconds(anchor.time),
                duration: Math.max(anchor.event.duration / 1000, 0.001),
                canvasId: anchor.canvasId,
                startIndex: anchor.index,
                endIndex: anchor.index,
                startPosition: anchor.position,
                endPosition: anchor.position,
            },
        ];
    });

    return [...scrollEvents, ...pauseEvents].sort((a, b) => a.start - b.start || a.duration - b.duration);
}

function getPreviewScrollEditAnchors(edit: PreviewScrollPointerEdit, clientY: number) {
    const deltaPx = Math.round(clientY - edit.pointerStartY);
    const coordinateHeightPx = getPreviewCoordinateHeight(edit.coordinateHeightPx);
    let startPixel = edit.originalStartPixel;
    let endPixel = edit.originalEndPixel;

    if (edit.mode === 'resize-start') {
        startPixel = clamp(edit.originalStartPixel + deltaPx, 0, coordinateHeightPx);
    } else if (edit.mode === 'resize-end') {
        endPixel = clamp(edit.originalEndPixel + deltaPx, 0, coordinateHeightPx);
    } else {
        const minPixel = Math.min(edit.originalStartPixel, edit.originalEndPixel);
        const maxPixel = Math.max(edit.originalStartPixel, edit.originalEndPixel);
        const clampedDeltaPx = clamp(deltaPx, -minPixel, coordinateHeightPx - maxPixel);

        startPixel = edit.originalStartPixel + clampedDeltaPx;
        endPixel = edit.originalEndPixel + clampedDeltaPx;
    }

    return {
        start: getPreviewScrollAnchor({
            stripPositionPx: startPixel,
            stripHeightPx: coordinateHeightPx,
            visualSegments: edit.visualSegments,
        }),
        end: getPreviewScrollAnchor({
            stripPositionPx: endPixel,
            stripHeightPx: coordinateHeightPx,
            visualSegments: edit.visualSegments,
        }),
    };
}

function getPreviewAnchorEditRequest(edit: PreviewAnchorPointerEdit, clientY: number) {
    const deltaPx = Math.round(clientY - edit.pointerStartY);
    const coordinateHeightPx = getPreviewCoordinateHeight(edit.coordinateHeightPx);
    const stripPositionPx = clamp(edit.originalPixel + deltaPx, 0, coordinateHeightPx);

    return toDraggedScrollAnchorMutationRequest({
        anchor: edit.anchor,
        stripHeightPx: coordinateHeightPx,
        stripPositionPx,
        visualSegments: edit.visualSegments,
    });
}

function getPreviewCueEditRequest(edit: PreviewCuePointerEdit, clientY: number) {
    const deltaPx = Math.round(clientY - edit.pointerStartY);
    const coordinateHeightPx = getPreviewCoordinateHeight(edit.coordinateHeightPx);
    const minPixel = Math.min(edit.originalStartPixel, edit.originalEndPixel);
    const maxPixel = Math.max(edit.originalStartPixel, edit.originalEndPixel);
    const clampedDeltaPx = clamp(deltaPx, -minPixel, coordinateHeightPx - maxPixel);

    return toCuePositionUpdateRequest({
        stripHeightPx: coordinateHeightPx,
        startStripPositionPx: edit.originalStartPixel + clampedDeltaPx,
        endStripPositionPx: edit.originalEndPixel + clampedDeltaPx,
        visualClips: edit.visualClips,
        visualSegments: edit.visualSegments,
    });
}

function getTimelineEditTiming(edit: TimelinePointerEdit, clientX: number, pxPerSecond: number, durationSeconds: number, isSnapEnabled: boolean) {
    const deltaSeconds = getTimelineEditSeconds((clientX - edit.pointerStartX) / pxPerSecond, isSnapEnabled);
    const flexibleDurationLimit = Math.max(
        durationSeconds,
        edit.originalStart + edit.originalDuration + TIMELINE_RESIZE_EXTENSION_SECONDS,
    );
    const minDuration = getTimelineResizeMinDurationSeconds(edit.maxDuration, MIN_TIMELINE_ITEM_DURATION_SECONDS);

    if (edit.mode === 'resize-start') {
        const originalEnd = edit.originalStart + edit.originalDuration;
        const maxStart = Math.max(0, originalEnd - minDuration);
        const start = getTimelineEditSeconds(clamp(edit.originalStart + deltaSeconds, 0, maxStart), isSnapEnabled);
        const duration = Math.max(minDuration, getTimelineEditSeconds(originalEnd - start, isSnapEnabled));

        return clampTimelineAudioResizeTiming({
            edge: 'start',
            start,
            duration,
            itemEnd: originalEnd,
            maxDuration: edit.maxDuration,
            minDuration,
        });
    }

    if (edit.mode === 'resize-end') {
        const maxDuration = Math.max(
            minDuration,
            flexibleDurationLimit - edit.originalStart,
        );
        const duration = Math.max(
            minDuration,
            getTimelineEditSeconds(clamp(edit.originalDuration + deltaSeconds, minDuration, maxDuration), isSnapEnabled),
        );

        return clampTimelineAudioResizeTiming({
            edge: 'end',
            start: edit.originalStart,
            duration,
            itemEnd: edit.originalStart + duration,
            maxDuration: edit.maxDuration,
            minDuration,
        });
    }

    const maxStart = Math.max(0, flexibleDurationLimit - edit.originalDuration);

    return {
        start: getTimelineEditSeconds(clamp(edit.originalStart + deltaSeconds, 0, maxStart), isSnapEnabled),
        duration: edit.originalDuration,
    };
}

function getTimelineAnchorEditRequest(
    edit: TimelineAnchorPointerEdit,
    clientX: number,
    pxPerSecond: number,
    durationSeconds: number,
    isSnapEnabled: boolean,
) {
    const deltaSeconds = getTimelineEditSeconds((clientX - edit.pointerStartX) / pxPerSecond, isSnapEnabled);
    const flexibleDurationLimit = Math.max(durationSeconds, edit.originalTimeSeconds + TIMELINE_RESIZE_EXTENSION_SECONDS);
    const timeSeconds = getTimelineEditSeconds(clamp(edit.originalTimeSeconds + deltaSeconds, 0, flexibleDurationLimit), isSnapEnabled);

    return toTimelineDraggedScrollAnchorMutationRequest({
        anchor: edit.anchor,
        timeSeconds,
    });
}

function getTimelinePointerCaptureTarget(target: HTMLElement) {
    const button = target.closest('button');

    return button instanceof HTMLElement ? button : target;
}

function useSelectedPreviewVisual(selectedId: string, visualClips: VisualClip[]) {
    return useMemo(() => getSelectedPreviewVisual(visualClips, selectedId), [selectedId, visualClips]);
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

function CharacterAvatar({ character, size = 'md' }: { character: CharacterDefinition; size?: 'sm' | 'md' | 'lg' }) {
    return (
        <span
            className={`odx-avatar odx-avatar-${size} ${character.imageUrl ? 'has-image' : ''}`}
            style={{ '--odx-avatar-color': character.color } as CSSProperties}
        >
            <span className="odx-avatar-initial">{character.initial}</span>
            {character.imageUrl ? <img alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} src={character.imageUrl} /> : null}
        </span>
    );
}

function LibraryPanel({
    activePanelId,
    audioItems,
    audioUploadState,
    characters,
    characterCreateState,
    dialogueLines,
    dialogueLoadError,
    isDialogueLoading,
    mediaItems,
    mediaUploadState,
    mediaContextMenu,
    selectedMediaIds,
    deletingMediaId,
    onAddAudio,
    onCharacterCreateDraftChange,
    onCreateCharacter,
    onToggleCharacterCreate,
    onApplyEffect,
    onAddMedia,
    onSelectMedia,
    onOpenMediaContextMenu,
    onCloseMediaContextMenu,
    onDeleteMedia,
}: {
    activePanelId: PanelId;
    audioItems: AudioListItem[];
    audioUploadState: AudioUploadState;
    characters: CharacterDefinition[];
    characterCreateState: CharacterCreatePanelState;
    dialogueLines: DialogueLine[];
    dialogueLoadError: string | null;
    isDialogueLoading: boolean;
    mediaItems: MediaListItem[];
    mediaUploadState: MediaUploadState;
    mediaContextMenu: MediaContextMenuState | null;
    selectedMediaIds: number[];
    deletingMediaId: number | null;
    onAddAudio: (file: File) => Promise<void>;
    onCharacterCreateDraftChange: (draft: CharacterCreateDraft) => void;
    onCreateCharacter: () => Promise<void>;
    onToggleCharacterCreate: () => void;
    onApplyEffect: (effectId: EffectId) => void;
    onAddMedia: (files: File[]) => Promise<void>;
    onSelectMedia: (event: ReactMouseEvent<HTMLElement>, mediaId: number) => void;
    onOpenMediaContextMenu: (event: ReactMouseEvent<HTMLElement>, media: MediaListItem) => void;
    onCloseMediaContextMenu: () => void;
    onDeleteMedia: (mediaId: number) => Promise<void>;
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
                <span>소스, 프리셋, 미디어 검색</span>
            </div>
            <div className="odx-library-body">
                {renderPanelContent(
                    activePanelId,
                    audioItems,
                    audioUploadState,
                    characters,
                    characterCreateState,
                    dialogueLines,
                    dialogueLoadError,
                    isDialogueLoading,
                    mediaItems,
                    mediaUploadState,
                    mediaContextMenu,
                    selectedMediaIds,
                    deletingMediaId,
                    onAddAudio,
                    onCharacterCreateDraftChange,
                    onCreateCharacter,
                    onToggleCharacterCreate,
                    onApplyEffect,
                    onAddMedia,
                    onSelectMedia,
                    onOpenMediaContextMenu,
                    onCloseMediaContextMenu,
                    onDeleteMedia,
                )}
            </div>
        </aside>
    );
}

function CharacterLibrary({
    characters,
    createState,
    onCreateCharacter,
    onDraftChange,
    onToggleCreate,
}: {
    characters: CharacterDefinition[];
    createState: CharacterCreatePanelState;
    onCreateCharacter: () => Promise<void>;
    onDraftChange: (draft: CharacterCreateDraft) => void;
    onToggleCreate: () => void;
}) {
    const { draft, error, isOpen, isSaving } = createState;

    return (
        <div className="odx-panel-stack">
            <button
                className={`odx-character-add-button ${isOpen ? 'is-open' : ''}`}
                disabled={isSaving}
                onClick={onToggleCreate}
                type="button"
            >
                <span className="odx-effect-icon">
                    <StudioIcon name="plus" size={19} />
                </span>
                <span>
                    <strong>캐릭터 추가</strong>
                    <small>이름, 역할, 이미지 URL 등록</small>
                    <em>characters.create API</em>
                </span>
            </button>
            {isOpen ? (
                <form
                    className="odx-character-create-card"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void onCreateCharacter();
                    }}
                >
                    <label className="odx-character-create-field">
                        <span>이름</span>
                        <input
                            autoFocus
                            disabled={isSaving}
                            onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                            placeholder="예: 엘렌 예거"
                            value={draft.name}
                        />
                    </label>
                    <label className="odx-character-create-field">
                        <span>역할</span>
                        <select
                            disabled={isSaving}
                            onChange={(event) =>
                                onDraftChange({ ...draft, role: event.target.value as CharacterRole })
                            }
                            value={draft.role}
                        >
                            {characterRoleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="odx-character-create-field">
                        <span>이미지 URL</span>
                        <input
                            disabled={isSaving}
                            onChange={(event) => onDraftChange({ ...draft, imageUrl: event.target.value })}
                            placeholder="https://..."
                            value={draft.imageUrl}
                        />
                    </label>
                    {error ? (
                        <p className="odx-character-create-error" role="alert">
                            {error}
                        </p>
                    ) : null}
                    <div className="odx-character-create-actions">
                        <button disabled={isSaving} onClick={onToggleCreate} type="button">
                            취소
                        </button>
                        <button disabled={isSaving || !draft.name.trim()} type="submit">
                            {isSaving ? '등록 중' : '등록'}
                        </button>
                    </div>
                </form>
            ) : null}
            {characters.length > 0 ? (
                characters.map((character) => (
                    <button className="odx-character-row" key={character.id} type="button">
                        <CharacterAvatar character={character} size="lg" />
                        <span>
                            <strong>{character.name}</strong>
                            <small>{character.role}</small>
                            <em>{character.meta}</em>
                        </span>
                    </button>
                ))
            ) : (
                <p className="odx-empty-note">등록된 캐릭터가 없습니다.</p>
            )}
        </div>
    );
}

function AudioLibrary({
    audioItems,
    uploadState,
    onAddAudio,
}: {
    audioItems: AudioListItem[];
    uploadState: AudioUploadState;
    onAddAudio: (file: File) => Promise<void>;
}) {
    const isUploading = uploadState.status !== 'idle';
    const progressLabel =
        uploadState.status === 'extracting'
            ? 'MP4 음성 추출 중'
            : uploadState.status === 'registering'
              ? 'audio.create API 등록 중'
              : 'presigned URL 업로드';

    return (
        <div className="odx-panel-stack">
            <div className="odx-audio-upload">
                <label className={`odx-audio-add-button ${isUploading ? 'is-busy' : ''}`}>
                    <span className="odx-effect-icon">
                        <StudioIcon name="plus" size={19} />
                    </span>
                    <span>
                        <strong>{isUploading ? '오디오 등록 중' : '오디오 추가'}</strong>
                        <small>{isUploading ? uploadState.fileName : '오디오 또는 MP4 업로드'}</small>
                        <em>{progressLabel}</em>
                    </span>
                    <input
                        accept="audio/*,video/mp4,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.mp4"
                        disabled={isUploading}
                        onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = '';

                            if (file) {
                                void onAddAudio(file);
                            }
                        }}
                        type="file"
                    />
                </label>
                {uploadState.error ? <p className="odx-audio-upload-message is-error">{uploadState.error}</p> : null}
            </div>
            {audioItems.length > 0 ? (
                audioItems.map((audio, index) => (
                    <button
                        className="odx-audio-asset"
                        draggable
                        key={audio.id}
                        onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'copy';
                            event.dataTransfer.setData(AUDIO_DRAG_MIME, String(audio.id));
                        }}
                        type="button"
                    >
                        <span className="odx-wave-mini">
                            {waveformBars.slice(0, 9).map((height, barIndex) => (
                                <i key={`${audio.id}-${height}-${barIndex}`} style={{ height: `${height / 2}px` }} />
                            ))}
                        </span>
                        <span>
                            <strong>{audio.name?.trim() || `오디오 ${String(index + 1).padStart(2, '0')}`}</strong>
                            <small>
                                {getAudioTypeLabel(audio.audioType)} · {formatAudioDuration(audio.duration)}
                            </small>
                            <em>AUDIO {audio.id}</em>
                        </span>
                    </button>
                ))
            ) : (
                <p className="odx-empty-note">등록된 오디오가 없습니다.</p>
            )}
        </div>
    );
}

function renderPanelContent(
    activePanelId: PanelId,
    audioItems: AudioListItem[],
    audioUploadState: AudioUploadState,
    characters: CharacterDefinition[],
    characterCreateState: CharacterCreatePanelState,
    dialogueLines: DialogueLine[],
    dialogueLoadError: string | null,
    isDialogueLoading: boolean,
    mediaItems: MediaListItem[],
    mediaUploadState: MediaUploadState,
    mediaContextMenu: MediaContextMenuState | null,
    selectedMediaIds: number[],
    deletingMediaId: number | null,
    onAddAudio: (file: File) => Promise<void>,
    onCharacterCreateDraftChange: (draft: CharacterCreateDraft) => void,
    onCreateCharacter: () => Promise<void>,
    onToggleCharacterCreate: () => void,
    onApplyEffect: (effectId: EffectId) => void,
    onAddMedia: (files: File[]) => Promise<void>,
    onSelectMedia: (event: ReactMouseEvent<HTMLElement>, mediaId: number) => void,
    onOpenMediaContextMenu: (event: ReactMouseEvent<HTMLElement>, media: MediaListItem) => void,
    onCloseMediaContextMenu: () => void,
    onDeleteMedia: (mediaId: number) => Promise<void>,
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
            <CharacterLibrary
                characters={characters}
                createState={characterCreateState}
                onCreateCharacter={onCreateCharacter}
                onDraftChange={onCharacterCreateDraftChange}
                onToggleCreate={onToggleCharacterCreate}
            />
        );
    }

    if (activePanelId === 'assets') {
        const isUploading = mediaUploadState.status !== 'idle';
        const selectedMediaIdSet = new Set(selectedMediaIds);

        return (
            <div className="odx-cut-list">
                <div className="odx-media-upload">
                    <label className={`odx-media-add-button ${isUploading ? 'is-busy' : ''}`}>
                        <span className="odx-effect-icon">
                            <StudioIcon name="plus" size={19} />
                        </span>
                        <span>
                            <strong>{isUploading ? '미디어 등록 중' : '미디어 추가'}</strong>
                            <small>{isUploading ? mediaUploadState.fileName : '이미지 또는 영상 파일 업로드'}</small>
                            <em>{mediaUploadState.status === 'registering' ? 'media.create API 등록 중' : 'presigned URL 업로드'}</em>
                        </span>
                        <input
                            accept="image/*,video/*"
                            disabled={isUploading}
                            multiple
                            onChange={(event) => {
                                const files = Array.from(event.currentTarget.files ?? []);
                                event.currentTarget.value = '';

                                if (files.length > 0) {
                                    void onAddMedia(files);
                                }
                            }}
                            type="file"
                        />
                    </label>
                    {mediaUploadState.error ? <p className="odx-media-upload-message is-error">{mediaUploadState.error}</p> : null}
                    {mediaUploadState.failures && mediaUploadState.failures.length > 0 ? (
                        <ul className="odx-media-upload-failures">
                            {mediaUploadState.failures.map((failure) => (
                                <li key={`${failure.fileName}-${failure.error}`}>
                                    <span>{failure.fileName}</span>
                                    <small>{failure.error}</small>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
                {mediaItems.length > 0 ? (
                    mediaItems.map((media, index) => (
                        <button
                            aria-pressed={selectedMediaIdSet.has(media.id)}
                            className={`odx-cut-card ${selectedMediaIdSet.has(media.id) ? 'is-selected' : ''} ${deletingMediaId === media.id ? 'is-deleting' : ''}`}
                            draggable={deletingMediaId !== media.id}
                            key={media.id}
                            onClick={(event) => {
                                onSelectMedia(event, media.id);
                            }}
                            onContextMenu={(event) => onOpenMediaContextMenu(event, media)}
                            onDragStart={(event) => {
                                if (deletingMediaId === media.id) {
                                    event.preventDefault();
                                    return;
                                }

                                const dragMediaIds = selectedMediaIdSet.has(media.id)
                                    ? mediaItems
                                          .filter((item) => selectedMediaIdSet.has(item.id))
                                          .map((item) => item.id)
                                    : [media.id];
                                const dragPayload = buildMediaDragPayload(dragMediaIds);

                                if (!dragPayload.primaryId) {
                                    event.preventDefault();
                                    return;
                                }

                                event.dataTransfer.effectAllowed = 'copy';
                                event.dataTransfer.setData(MEDIA_DRAG_MIME, String(dragPayload.primaryId));
                                event.dataTransfer.setData(MEDIA_BATCH_DRAG_MIME, JSON.stringify(dragPayload.ids));
                                event.dataTransfer.setData(
                                    'text/plain',
                                    dragPayload.ids.length > 1
                                        ? `${dragPayload.ids.length}개 미디어`
                                        : media.mediaName?.trim() || `${getMediaTypeLabel(media.mediaType)} ${String(index + 1).padStart(2, '0')}`,
                                );
                            }}
                            type="button"
                        >
                            <span className="odx-cut-thumb" style={getMediaThumbStyle(media, index)} />
                            <span>
                                <strong>{media.mediaName?.trim() || `${getMediaTypeLabel(media.mediaType)} ${String(index + 1).padStart(2, '0')}`}</strong>
                                <small>{getMediaTypeLabel(media.mediaType)} 미디어</small>
                                <em>MEDIA {media.id}</em>
                            </span>
                        </button>
                    ))
                ) : (
                    <p className="odx-empty-note">등록된 미디어가 없습니다.</p>
                )}
                {mediaContextMenu ? (
                    <>
                        <button aria-label="미디어 메뉴 닫기" className="odx-media-context-backdrop" onClick={onCloseMediaContextMenu} type="button" />
                        <div className="odx-media-context-menu" role="menu" style={{ left: mediaContextMenu.x, top: mediaContextMenu.y }}>
                            <button disabled={deletingMediaId === mediaContextMenu.mediaId} onClick={() => void onDeleteMedia(mediaContextMenu.mediaId)} role="menuitem" type="button">
                                {deletingMediaId === mediaContextMenu.mediaId ? '삭제 중...' : '미디어 삭제'}
                            </button>
                        </div>
                    </>
                ) : null}
            </div>
        );
    }

    if (activePanelId === 'audio') {
        return <AudioLibrary audioItems={audioItems} uploadState={audioUploadState} onAddAudio={onAddAudio} />;
    }

    if (activePanelId === 'text') {
        return (
            <div className="odx-subtitle-list">
                {isDialogueLoading ? <p className="odx-empty-note">대사를 불러오는 중입니다.</p> : null}
                {dialogueLoadError ? <p className="odx-empty-note">{dialogueLoadError}</p> : null}
                {!isDialogueLoading && !dialogueLoadError && dialogueLines.length === 0 ? (
                    <p className="odx-empty-note">등록된 대사가 없습니다.</p>
                ) : null}
                {dialogueLines.map((line) => (
                    <button className="odx-subtitle-row" key={line.id} type="button">
                        <time>{line.time}</time>
                        <span>
                            <strong>{line.text}</strong>
                            <em>{line.meta}</em>
                        </span>
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

function ImageCompositionSaveButton({
    canConfirm,
    error,
    isConfirming,
    onConfirm,
}: {
    canConfirm: boolean;
    error: string | null;
    isConfirming: boolean;
    onConfirm: () => Promise<void> | void;
}) {
    return (
        <div className="odx-cut-edit-save">
            {error ? (
                <span className="odx-cut-edit-save-error" role="alert">
                    {error}
                </span>
            ) : null}
            <button disabled={!canConfirm || isConfirming} onClick={onConfirm} type="button">
                {isConfirming ? '저장 중' : '변경 저장'}
            </button>
        </div>
    );
}

function CutEditWorkspace({
    anchors,
    canvasSummaries,
    activeCanvasId,
    playhead,
    playbackScrollEvents,
    selectedId,
    activeVisual,
    canConfirmImageComposition,
    imageCompositionConfirmError,
    isConfirmingImageComposition,
    isAddingAnchor,
    isAddingCue,
    isAnchorPlacementMode,
    isCuePlacementMode,
    isPreviewLocked,
    previewAnchorEditingId,
    previewCueEditingId,
    previewScrollEditingId,
    previewStripHeightPx,
    previewVisualSegments,
    scrollEvents,
    cueTracks,
    cuePlacementTrackId,
    focusedTrackId,
    visualCutEditingId,
    onImageCompositionConfirm,
    onMediaDrop,
    onOpenTrackModal,
    onPlaceAnchor,
    onPlaceCue,
    onPreviewStripHeightChange,
    onPreviewVisualSegmentsChange,
    onSelectAnchor,
    onSelectCanvas,
    onSelectCue,
    onSelectScrollEvent,
    onSelectVisual,
    onFocusTrack,
    onToggleAnchorPlacement,
    onToggleCuePlacement,
    onPreviewAnchorEditEnd,
    onPreviewAnchorEditMove,
    onPreviewAnchorEditStart,
    onPreviewCueEditEnd,
    onPreviewCueEditMove,
    onPreviewCueEditStart,
    onPreviewScrollEditEnd,
    onPreviewScrollEditMove,
    onPreviewScrollEditStart,
    onVisualCutEditStart,
    onVisualCutEditMove,
    onVisualCutEditEnd,
}: {
    anchors: AnchorListItem[];
    canvasSummaries: CutEditCanvasSummary[];
    activeCanvasId: number | null;
    playhead: number;
    playbackScrollEvents: PreviewScrollPositionEvent[];
    selectedId: string;
    activeVisual: VisualClip | undefined;
    canConfirmImageComposition: boolean;
    imageCompositionConfirmError: string | null;
    isConfirmingImageComposition: boolean;
    isAddingAnchor: boolean;
    isAddingCue: boolean;
    isAnchorPlacementMode: boolean;
    isCuePlacementMode: boolean;
    isPreviewLocked: boolean;
    previewAnchorEditingId: number | null;
    previewCueEditingId: number | null;
    previewScrollEditingId: string | null;
    previewStripHeightPx: number;
    previewVisualSegments: PreviewScrollVisualSegment[];
    scrollEvents: ScrollEventClip[];
    cueTracks: CutEditCueTrack[];
    cuePlacementTrackId: string;
    focusedTrackId: string;
    visualCutEditingId: string | null;
    onImageCompositionConfirm: () => Promise<void> | void;
    onMediaDrop: (event: ReactDragEvent<HTMLElement>) => void;
    onOpenTrackModal: () => void;
    onPlaceAnchor: (stripPositionPx: number, stripHeightPx: number) => Promise<void> | void;
    onPlaceCue: (stripPositionPx: number, stripHeightPx: number) => Promise<void> | void;
    onPreviewStripHeightChange: (heightPx: number) => void;
    onPreviewVisualSegmentsChange: (segments: PreviewScrollVisualSegment[]) => void;
    onSelectAnchor: (anchorId: number) => void;
    onSelectCanvas: (canvasId: number) => void;
    onSelectCue: (cueId: number) => void;
    onSelectScrollEvent: (clipId: string) => void;
    onSelectVisual: (clipId: string) => void;
    onFocusTrack: (trackId: string) => void;
    onToggleAnchorPlacement: () => void;
    onToggleCuePlacement: () => void;
} & PreviewScrollPointerEditHandlers &
    PreviewAnchorPointerEditHandlers &
    PreviewCuePointerEditHandlers &
    VisualCutPointerEditHandlers) {
    const [cutEditorZoom, setCutEditorZoom] = useState(1);
    const [isMediaDropActive, setIsMediaDropActive] = useState(false);
    const cutEditStripRef = useRef<HTMLDivElement | null>(null);
    const activeCanvas = canvasSummaries.find((canvas) => canvas.id === activeCanvasId);
    const activeCanvasVisualClips = activeCanvas?.clips ?? [];
    const activeVisualInCanvas = activeVisual?.canvasId === activeCanvasId ? activeVisual : undefined;
    const selectedVisual =
        activeCanvasVisualClips.find((clip) => clip.id === selectedId) ?? activeVisualInCanvas ?? activeCanvasVisualClips[0];
    const cutBaseHeight = getPreviewCutHeight(activeCanvasVisualClips.length);
    const cutEditCoordinateHeightPx = getPreviewCoordinateHeight(previewStripHeightPx);
    const activeScrollEvent = scrollEvents.find((event) => playhead >= event.start && playhead < event.start + event.duration);
    const selectedScrollEvent = scrollEvents.find((event) => event.id === selectedId);
    const handleScrollEvent = selectedScrollEvent ?? activeScrollEvent;
    const selectedCueTrack = cueTracks.find((track) => track.id === cuePlacementTrackId) ?? cueTracks.find((track) => track.id === focusedTrackId) ?? cueTracks[0];
    const cutCueTrackLaneWidth = 152;
    const cutCueTrackLayerWidth = cueTracks.length > 0 ? cueTracks.length * cutCueTrackLaneWidth : 0;
    const previewPlayheadPixel = getPreviewPlayheadPixel(
        playhead,
        playbackScrollEvents,
        cutEditCoordinateHeightPx,
        previewVisualSegments,
    );
    const previewAnchorMarkers = useMemo(
        () =>
            anchors
                .map((anchor) => ({
                    anchor,
                    top: getPreviewScrollPixel({
                        canvasId: anchor.canvasId,
                        index: anchor.index,
                        position: anchor.position,
                        stripHeightPx: cutEditCoordinateHeightPx,
                        visualSegments: previewVisualSegments,
                    }),
                }))
                .filter((marker): marker is { anchor: AnchorListItem; top: number } => typeof marker.top === 'number'),
        [anchors, cutEditCoordinateHeightPx, previewVisualSegments],
    );
    const previewCueMarkers = useMemo(
        () =>
            cueTracks.flatMap((track, trackIndex) =>
                track.cues.flatMap((cue) => {
                    const marker = toCueStripMarker({
                        cue,
                        stripHeightPx: cutEditCoordinateHeightPx,
                        visualClips: activeCanvasVisualClips,
                        visualSegments: previewVisualSegments,
                    });

                    if (!marker) {
                        return [];
                    }

                    return [
                        {
                            ...marker,
                            cue,
                            cueId: `cue-${cue.id}`,
                            trackId: track.id,
                            trackLabel: track.label,
                            trackIndex,
                        } satisfies CutEditCueMarker,
                    ];
                }),
            ),
        [activeCanvasVisualClips, cueTracks, cutEditCoordinateHeightPx, previewVisualSegments],
    );
    const handleZoomStep = (delta: number) => {
        setCutEditorZoom((current) => clamp(Number((current + delta).toFixed(2)), 0.55, 1.45));
    };
    useEffect(() => {
        const strip = cutEditStripRef.current;

        if (!strip) {
            return;
        }

        const updateCutEditStripMetrics = () => {
            const stripRect = strip.getBoundingClientRect();
            const nextHeight = getPreviewCoordinateHeight(strip.scrollHeight || stripRect.height);
            const cutElements = Array.from(strip.querySelectorAll<HTMLElement>('.odx-cut-edit-block'));
            const nextSegments = activeCanvasVisualClips.map((clip, index) => {
                const cut = cutElements[index];
                const cutRect = cut?.getBoundingClientRect();

                return {
                    id: clip.id,
                    canvasId: clip.canvasId,
                    index: clip.index ?? index,
                    top: cutRect ? cutRect.top - stripRect.top : index * getPreviewCutHeight(activeCanvasVisualClips.length, nextHeight),
                    height: cutRect ? cutRect.height : getPreviewCutHeight(activeCanvasVisualClips.length, nextHeight),
                };
            });

            onPreviewStripHeightChange(nextHeight);
            onPreviewVisualSegmentsChange(nextSegments);
        };
        const resizeObserver = new ResizeObserver(updateCutEditStripMetrics);

        updateCutEditStripMetrics();
        resizeObserver.observe(strip);
        strip.querySelectorAll<HTMLElement>('.odx-cut-edit-block').forEach((cut) => resizeObserver.observe(cut));

        return () => {
            resizeObserver.disconnect();
        };
    }, [
        activeCanvasVisualClips,
        cutEditorZoom,
        onPreviewStripHeightChange,
        onPreviewVisualSegmentsChange,
    ]);
    const handleAnchorPlacementClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
        if (!isAnchorPlacementMode || isPreviewLocked || isAddingAnchor) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const rect = event.currentTarget.getBoundingClientRect();
        const stripPositionPx = clamp(event.clientY - rect.top, 0, cutEditCoordinateHeightPx);

        void onPlaceAnchor(stripPositionPx, cutEditCoordinateHeightPx);
    };
    const handleCuePlacementClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
        if (!isCuePlacementMode || isPreviewLocked || isAddingCue) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const rect = event.currentTarget.getBoundingClientRect();
        const stripPositionPx = clamp(event.clientY - rect.top, 0, cutEditCoordinateHeightPx);

        void onPlaceCue(stripPositionPx, cutEditCoordinateHeightPx);
    };
    const acceptsMediaDrag = (event: ReactDragEvent<HTMLElement>) => {
        const dragTypes = Array.from(event.dataTransfer.types);

        return dragTypes.includes(MEDIA_DRAG_MIME) || dragTypes.includes(MEDIA_BATCH_DRAG_MIME);
    };
    const handleMediaDragOver = (event: ReactDragEvent<HTMLElement>) => {
        if (!acceptsMediaDrag(event)) {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    };

    return (
        <div className="odx-cut-editor" aria-label="컷 편집 작업 영역">
            <aside className="odx-cut-edit-canvas-panel" aria-label="캔버스 목록">
                <div className="odx-cut-edit-canvas-head">
                    <span>CANVASES</span>
                    <b>{canvasSummaries.length}</b>
                </div>
                <div className="odx-cut-edit-canvas-list">
                    {canvasSummaries.length > 0 ? (
                        canvasSummaries.map((canvas) => (
                            <button
                                aria-pressed={canvas.id === activeCanvasId}
                                className={`odx-cut-edit-canvas-item ${canvas.id === activeCanvasId ? 'is-selected' : ''}`}
                                key={canvas.id}
                                onClick={() => onSelectCanvas(canvas.id)}
                                type="button"
                            >
                                <span className="odx-cut-edit-canvas-thumb">
                                    {canvas.clips.length > 0 ? (
                                        canvas.clips.slice(0, 6).map((clip) => (
                                            <i
                                                key={clip.id}
                                                style={{
                                                    background: clip.background,
                                                    flex: 1,
                                                }}
                                            />
                                        ))
                                    ) : (
                                        <i className="is-empty" />
                                    )}
                                </span>
                                <span className="odx-cut-edit-canvas-meta">
                                    <strong>{canvas.label}</strong>
                                    <small>{canvas.sublabel}</small>
                                </span>
                            </button>
                        ))
                    ) : (
                        <p className="odx-cut-edit-canvas-empty">등록된 캔버스가 없습니다.</p>
                    )}
                </div>
            </aside>
            <section
                className={`odx-cut-edit-stage ${isMediaDropActive ? 'is-media-drop-active' : ''}`}
                aria-label="컷 편집 스트립"
                onDragEnter={(event) => {
                    if (!acceptsMediaDrag(event)) {
                        return;
                    }

                    event.preventDefault();
                    setIsMediaDropActive(true);
                }}
                onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        return;
                    }

                    setIsMediaDropActive(false);
                }}
                onDragOver={handleMediaDragOver}
                onDrop={(event) => {
                    setIsMediaDropActive(false);
                    onMediaDrop(event);
                }}
            >
                <div className="odx-cut-edit-toolbar">
                    <button className="odx-cut-edit-tool" disabled title="canvas 등록 흐름 연결 후 활성화됩니다." type="button">
                        <StudioIcon name="split" size={13} />
                        분할
                    </button>
                    <button
                        aria-pressed={isAnchorPlacementMode}
                        className={`odx-cut-edit-tool ${isAnchorPlacementMode || isAddingAnchor ? 'is-active' : ''}`}
                        disabled={isPreviewLocked || isAddingAnchor}
                        onClick={onToggleAnchorPlacement}
                        title={
                            isPreviewLocked
                                ? '잠금 해제 후 앵커를 추가할 수 있습니다.'
                                : isAnchorPlacementMode
                                  ? '앵커 위치 선택 취소'
                                  : '컷 편집 스트립에서 앵커 위치 선택'
                        }
                        type="button"
                    >
                        <StudioIcon name="anchor" size={13} />
                        앵커
                    </button>
                    <button className="odx-cut-edit-tool" onClick={onOpenTrackModal} type="button">
                        <StudioIcon name="mic" size={13} />
                        트랙
                    </button>
                    <button
                        aria-pressed={isCuePlacementMode}
                        className={`odx-cut-edit-tool ${isCuePlacementMode || isAddingCue ? 'is-active' : ''}`}
                        disabled={isPreviewLocked || isAddingCue || cueTracks.length === 0}
                        onClick={onToggleCuePlacement}
                        title={
                            cueTracks.length === 0
                                ? '먼저 보이스 트랙을 생성해 주세요.'
                                : isPreviewLocked
                                  ? '잠금 해제 후 큐를 추가할 수 있습니다.'
                                  : isCuePlacementMode
                                    ? '큐 위치 선택 취소'
                                    : '컷 편집 스트립에서 큐 위치 선택'
                        }
                        type="button"
                    >
                        <StudioIcon name="text" size={13} />
                        큐
                    </button>
                    <span>
                        {activeCanvas
                            ? `${activeCanvas.label} 선택됨 · 미디어를 드롭하면 이 캔버스에 레이어로 추가`
                            : '왼쪽에서 수정할 캔버스를 선택'}
                    </span>
                    <div className="odx-cut-edit-zoom" role="group" aria-label="컷 편집 확대">
                        <button aria-label="컷 편집 축소" onClick={() => handleZoomStep(-0.1)} type="button">
                            -
                        </button>
                        <b>{Math.round(cutEditorZoom * 100)}%</b>
                        <button aria-label="컷 편집 확대" onClick={() => handleZoomStep(0.1)} type="button">
                            +
                        </button>
                        <button onClick={() => setCutEditorZoom(1)} type="button">
                            맞춤
                        </button>
                    </div>
                </div>
                <div className="odx-cut-edit-viewport">
                    <div
                        className="odx-cut-edit-strip"
                        ref={cutEditStripRef}
                        style={
                            {
                                '--odx-cut-edit-width': `${Math.round(232 * cutEditorZoom)}px`,
                                '--odx-cue-track-panel-width': `${cutCueTrackLayerWidth}px`,
                            } as CSSProperties
                        }
                    >
                        {activeCanvasVisualClips.length > 0 ? (
                            <>
                                {activeCanvasVisualClips.map((clip, index) => {
                                    const blockHeight = Math.max(52, cutBaseHeight * cutEditorZoom);
                                    const isSelected = selectedVisual?.id === clip.id;
                                    const blockStyle: CSSProperties = {
                                        ...getPreviewCutStyle(clip, activeCanvasVisualClips.length),
                                        ...(clip.mediaUrl ? {} : { height: `${blockHeight}px` }),
                                    };

                                    return (
                                        <button
                                            aria-label={`${clip.label} 레이어 선택`}
                                            className={`odx-cut-edit-block ${clip.kind === 'video' ? 'is-video' : ''} ${clip.mediaUrl ? 'has-media' : ''} ${isSelected ? 'is-selected' : ''} ${activeVisual?.id === clip.id ? 'is-active' : ''} ${visualCutEditingId === clip.id ? 'is-editing' : ''}`}
                                            key={clip.id}
                                            onClick={() => onSelectVisual(clip.id)}
                                            onPointerCancel={onVisualCutEditEnd}
                                            onPointerDown={(pointerEvent) => {
                                                if (isPreviewLocked) {
                                                    return;
                                                }

                                                onVisualCutEditStart({ event: pointerEvent, clip, index, mode: 'reorder' });
                                            }}
                                            onPointerMove={onVisualCutEditMove}
                                            onPointerUp={onVisualCutEditEnd}
                                            style={blockStyle}
                                            type="button"
                                        >
                                            {clip.mediaType === 'image' && clip.mediaUrl ? <img alt="" className="odx-cut-edit-media" src={clip.mediaUrl} /> : null}
                                            {clip.mediaType === 'video' && clip.mediaUrl ? <video className="odx-cut-edit-media" playsInline preload="metadata" src={clip.mediaUrl} /> : null}
                                            <span className="odx-cut-edit-label">
                                                {String(index + 1).padStart(2, '0')} · {clip.label}
                                            </span>
                                            {clip.mediaUrl ? null : <strong>{clip.description}</strong>}
                                            {clip.bubble ? <p className={`odx-speech-bubble odx-speech-${clip.bubble.tone ?? 'default'}`}>{clip.bubble.text}</p> : null}
                                            {clip.subtitle ? <small>{clip.subtitle}</small> : null}
                                        </button>
                                    );
                                })}
                                <div className="odx-preview-scroll-overlay" style={{ height: `${cutEditCoordinateHeightPx}px` }}>
                                    {scrollEvents.map((event) => {
                                        const isSelected = selectedId === event.id;
                                        const isActive = activeScrollEvent?.id === event.id;

                                        return (
                                            <button
                                                className={`odx-preview-scroll-event ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''} ${previewScrollEditingId === event.id ? 'is-position-editing' : ''}`}
                                                key={event.id}
                                                onClick={() => onSelectScrollEvent(event.id)}
                                                onPointerCancel={onPreviewScrollEditEnd}
                                                onPointerDown={(pointerEvent) => {
                                                    if (isPreviewLocked) {
                                                        return;
                                                    }

                                                    onPreviewScrollEditStart({ event: pointerEvent, item: event, mode: 'move' });
                                                }}
                                                onPointerMove={onPreviewScrollEditMove}
                                                onPointerUp={onPreviewScrollEditEnd}
                                                style={getPreviewScrollEventStyle(event, cutEditCoordinateHeightPx, previewVisualSegments)}
                                                type="button"
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="odx-preview-scroll-resize-handle odx-preview-scroll-resize-start"
                                                    onPointerDown={(pointerEvent) => {
                                                        if (isPreviewLocked) {
                                                            return;
                                                        }

                                                        onPreviewScrollEditStart({ event: pointerEvent, item: event, mode: 'resize-start' });
                                                    }}
                                                />
                                                <span
                                                    aria-hidden="true"
                                                    className="odx-preview-scroll-resize-handle odx-preview-scroll-resize-end"
                                                    onPointerDown={(pointerEvent) => {
                                                        if (isPreviewLocked) {
                                                            return;
                                                        }

                                                        onPreviewScrollEditStart({ event: pointerEvent, item: event, mode: 'resize-end' });
                                                    }}
                                                />
                                                <span>{event.label}</span>
                                                <small>{event.sublabel}</small>
                                            </button>
                                        );
                                    })}
                                    {handleScrollEvent ? (
                                        <div className="odx-scroll-handles" style={{ height: `${cutEditCoordinateHeightPx}px` }}>
                                            <span className="odx-scroll-handle-band" style={getPreviewScrollBandStyle(handleScrollEvent, cutEditCoordinateHeightPx, previewVisualSegments)} />
                                            <button
                                                aria-label="스크롤 이벤트 시작 위치 조절"
                                                className="odx-scroll-strip-line odx-scroll-strip-start"
                                                onPointerCancel={onPreviewScrollEditEnd}
                                                onPointerDown={(pointerEvent) => {
                                                    if (isPreviewLocked) {
                                                        return;
                                                    }

                                                    onPreviewScrollEditStart({ event: pointerEvent, item: handleScrollEvent, mode: 'resize-start' });
                                                }}
                                                onPointerMove={onPreviewScrollEditMove}
                                                onPointerUp={onPreviewScrollEditEnd}
                                                style={getPreviewScrollHandleStyle(getScrollEventStartPixel(handleScrollEvent, cutEditCoordinateHeightPx, previewVisualSegments))}
                                                type="button"
                                            >
                                                <span>시작 ▲ {formatScrollIndexedPosition(handleScrollEvent.startIndex, handleScrollEvent.startPosition)}</span>
                                            </button>
                                            <button
                                                aria-label="스크롤 이벤트 종료 위치 조절"
                                                className="odx-scroll-strip-line odx-scroll-strip-end"
                                                onPointerCancel={onPreviewScrollEditEnd}
                                                onPointerDown={(pointerEvent) => {
                                                    if (isPreviewLocked) {
                                                        return;
                                                    }

                                                    onPreviewScrollEditStart({ event: pointerEvent, item: handleScrollEvent, mode: 'resize-end' });
                                                }}
                                                onPointerMove={onPreviewScrollEditMove}
                                                onPointerUp={onPreviewScrollEditEnd}
                                                style={getPreviewScrollHandleStyle(getScrollEventEndPixel(handleScrollEvent, cutEditCoordinateHeightPx, previewVisualSegments))}
                                                type="button"
                                            >
                                                <span>종료 ▼ {formatScrollIndexedPosition(handleScrollEvent.endIndex, handleScrollEvent.endPosition)}</span>
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                                <div className="odx-preview-anchor-layer" style={{ height: `${cutEditCoordinateHeightPx}px` }}>
                                    {previewAnchorMarkers.map(({ anchor, top }) => (
                                        <div
                                            className={`odx-preview-anchor-marker ${selectedId === getAnchorSelectionId(anchor.id) ? 'is-selected' : ''} ${previewAnchorEditingId === anchor.id ? 'is-dragging' : ''}`}
                                            key={anchor.id}
                                            style={{ top: `${top}px` }}
                                        >
                                            <span aria-hidden="true" className="odx-preview-anchor-line" />
                                            <button
                                                aria-label={`앵커 ${anchor.id}`}
                                                className="odx-preview-anchor-handle"
                                                onClick={() => onSelectAnchor(anchor.id)}
                                                onPointerCancel={onPreviewAnchorEditEnd}
                                                onPointerDown={(pointerEvent) => {
                                                    if (isPreviewLocked || isAddingAnchor) {
                                                        return;
                                                    }

                                                    onPreviewAnchorEditStart({ event: pointerEvent, anchor, top });
                                                }}
                                                onPointerMove={onPreviewAnchorEditMove}
                                                onPointerUp={onPreviewAnchorEditEnd}
                                                type="button"
                                            >
                                                <b>A{anchor.id}</b>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {cueTracks.length > 0 ? (
                                    <div className="odx-cut-cue-track-layer" style={{ height: `${cutEditCoordinateHeightPx}px` }}>
                                        <div className="odx-cut-cue-track-header-layer">
                                            {cueTracks.map((track, trackIndex) => (
                                                <button
                                                    aria-pressed={focusedTrackId === track.id}
                                                    className={`odx-cut-cue-track-header ${focusedTrackId === track.id ? 'is-focused' : ''}`}
                                                    key={`cue-track-header-${track.id}`}
                                                    onClick={() => onFocusTrack(track.id)}
                                                    style={
                                                        {
                                                            left: `${trackIndex * cutCueTrackLaneWidth}px`,
                                                            width: `${cutCueTrackLaneWidth - 8}px`,
                                                            '--odx-track-color': track.color ?? 'rgba(52, 211, 153, 0.82)',
                                                        } as CSSProperties
                                                    }
                                                    title={track.label}
                                                    type="button"
                                                >
                                                    <span>{track.label}</span>
                                                    <small>{track.cues.length}</small>
                                                </button>
                                            ))}
                                        </div>
                                        {cueTracks.map((track, trackIndex) => (
                                            <button
                                                aria-label={`${track.label} 트랙 선택`}
                                                aria-pressed={focusedTrackId === track.id}
                                                className={`odx-cut-cue-track-column ${focusedTrackId === track.id ? 'is-focused' : ''}`}
                                                key={track.id}
                                                onClick={() => onFocusTrack(track.id)}
                                                style={
                                                    {
                                                        left: `${trackIndex * cutCueTrackLaneWidth}px`,
                                                        width: `${cutCueTrackLaneWidth - 8}px`,
                                                        '--odx-track-color': track.color ?? 'rgba(52, 211, 153, 0.82)',
                                                    } as CSSProperties
                                                }
                                                title={track.label}
                                                type="button"
                                            />
                                        ))}
                                        {previewCueMarkers.map((marker) => {
                                            const cueRangeHeight = Math.max(2, Math.abs(marker.endTop - marker.top));

                                            return (
                                                <button
                                                    aria-label={`${marker.trackLabel} 큐 ${marker.cue.id}`}
                                                    className={`odx-cut-cue-marker ${selectedId === marker.cueId ? 'is-selected' : ''} ${previewCueEditingId === marker.cue.id ? 'is-dragging' : ''}`}
                                                    key={`${marker.trackId}-${marker.cue.id}`}
                                                    onClick={() => onSelectCue(marker.cue.id)}
                                                    onPointerCancel={onPreviewCueEditEnd}
                                                    onPointerDown={(pointerEvent) => {
                                                        if (isPreviewLocked || isAddingCue) {
                                                            return;
                                                        }

                                                        onPreviewCueEditStart({ event: pointerEvent, marker });
                                                    }}
                                                    onPointerMove={onPreviewCueEditMove}
                                                    onPointerUp={onPreviewCueEditEnd}
                                                    style={
                                                        {
                                                            top: `${marker.top}px`,
                                                            left: `${marker.trackIndex * cutCueTrackLaneWidth + 4}px`,
                                                            width: `${cutCueTrackLaneWidth - 16}px`,
                                                            '--odx-cue-range-height': `${cueRangeHeight}px`,
                                                        } as CSSProperties
                                                    }
                                                    title={`${marker.trackLabel} · ${Math.round(marker.cue.startPosition)}%`}
                                                    type="button"
                                                >
                                                    <span>{marker.cue.script || '큐'}</span>
                                                    <small>{Math.round(marker.cue.startPosition)}%</small>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : null}
                                {isAnchorPlacementMode ? (
                                    <button
                                        aria-label="앵커 위치 선택"
                                        className="odx-anchor-placement-layer"
                                        disabled={isPreviewLocked || isAddingAnchor}
                                        onClick={handleAnchorPlacementClick}
                                        style={{ height: `${cutEditCoordinateHeightPx}px` }}
                                        title="앵커 추가"
                                        type="button"
                                    >
                                        <span>A+</span>
                                    </button>
                                ) : null}
                                {isCuePlacementMode ? (
                                    <button
                                        aria-label="큐 위치 선택"
                                        className="odx-cue-placement-layer"
                                        disabled={isPreviewLocked || isAddingCue}
                                        onClick={handleCuePlacementClick}
                                        style={{ height: `${cutEditCoordinateHeightPx}px` }}
                                        title="큐 추가"
                                        type="button"
                                    >
                                        <span>Q+</span>
                                    </button>
                                ) : null}
                                {previewPlayheadPixel !== undefined ? (
                                    <div className="odx-strip-playhead" style={{ top: `${previewPlayheadPixel}px` }}>
                                        <span>{formatTime(playhead)}</span>
                                    </div>
                                ) : null}
                            </>
                        ) : (
                            <div className="odx-cut-edit-empty-strip">
                                {activeCanvas ? '이 캔버스에 등록된 레이어가 없습니다. 미디어를 드래그해 추가하세요.' : '수정할 캔버스를 선택하세요.'}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <aside className="odx-cut-edit-props">
                {selectedVisual ? (
                    <div className="odx-cut-edit-props-head">
                        <span className="odx-cut-edit-props-thumb" style={getVisualClipThumbStyle(selectedVisual)}>
                            {selectedVisual.kind === 'video' ? <StudioIcon name="play" size={16} /> : null}
                        </span>
                        <span>
                            <strong>{selectedVisual.label}</strong>
                            <small>{selectedVisual.mediaType ?? selectedVisual.kind}</small>
                        </span>
                    </div>
                ) : (
                    <div className="odx-cut-edit-empty">선택된 레이어가 없습니다.</div>
                )}
                {selectedVisual ? (
                    <div className="odx-cut-edit-section">
                        <div className="odx-cut-edit-section-title">미디어 정보</div>
                        <div className="odx-cut-edit-info-grid">
                            {getCutEditMediaDetails(selectedVisual).flatMap((detail) => [
                                <span key={`${detail.label}-label`}>{detail.label}</span>,
                                <b key={`${detail.label}-value`}>{detail.value}</b>,
                            ])}
                        </div>
                    </div>
                ) : null}
                <div className="odx-cut-edit-section">
                    <div className="odx-cut-edit-section-title">큐 등록</div>
                    <div className="odx-cut-edit-cue-controls">
                        <label>
                            <span>트랙</span>
                            <select
                                disabled={cueTracks.length === 0 || isAddingCue}
                                onChange={(event) => onFocusTrack(event.target.value)}
                                value={selectedCueTrack?.id ?? ''}
                            >
                                {cueTracks.length > 0 ? (
                                    cueTracks.map((track) => (
                                        <option key={track.id} value={track.id}>
                                            {track.label}
                                        </option>
                                    ))
                                ) : (
                                    <option value="">보이스 트랙 없음</option>
                                )}
                            </select>
                        </label>
                        <div className="odx-cut-edit-cue-row">
                            <button onClick={onOpenTrackModal} type="button">
                                <StudioIcon name="plus" size={13} />
                                트랙
                            </button>
                            <button
                                className={isCuePlacementMode ? 'is-active' : ''}
                                disabled={cueTracks.length === 0 || isPreviewLocked || isAddingCue}
                                onClick={onToggleCuePlacement}
                                type="button"
                            >
                                <StudioIcon name="text" size={13} />
                                {isCuePlacementMode ? '위치 선택 중' : '큐 위치'}
                            </button>
                        </div>
                    </div>
                </div>
                <ImageCompositionSaveButton
                    canConfirm={canConfirmImageComposition}
                    error={imageCompositionConfirmError}
                    isConfirming={isConfirmingImageComposition}
                    onConfirm={onImageCompositionConfirm}
                />
            </aside>
        </div>
    );
}

function PreviewCanvas({
    activeVisual,
    previewActiveVisual,
    activeCutCanvasId,
    playhead,
    canConfirmImageComposition,
    canvasSummaries,
    canvasOptions,
    imageCompositionConfirmError,
    previewZoom,
    previewMode,
    previewStripHeightPx,
    previewVisualSegments,
    previewVisualClips,
    selectedPreviewCanvasId,
    isConfirmingImageComposition,
    isAddingAnchor,
    isAddingCue,
    isAnchorPlacementMode,
    isCuePlacementMode,
    isPreviewAudioEnabled,
    isPreviewFullscreen,
    isPreviewLocked,
    isPlaying,
    effects,
    visualClips,
    scrollEvents,
    cueTracks,
    cuePlacementTrackId,
    focusedTrackId,
    playbackScrollEvents,
    anchors,
    selectedId,
    onImageCompositionConfirm,
    onMediaDrop,
    onOpenTrackModal,
    onPreviewModeChange,
    onPreviewStripHeightChange,
    onPreviewVisualSegmentsChange,
    onPreviewZoomChange,
    onPreviewZoomStep,
    onSelectPreviewCanvas,
    onSelectVisual,
    onSelectCutCanvas,
    onFocusTrack,
    onSelectCue,
    onToggleAnchorPlacement,
    onToggleCuePlacement,
    onPlaceAnchor,
    onPlaceCue,
    onSelectAnchor,
    onSelectScrollEvent,
    previewScrollEditingId,
    previewAnchorEditingId,
    onPreviewScrollEditStart,
    onPreviewScrollEditMove,
    onPreviewScrollEditEnd,
    onPreviewAnchorEditStart,
    onPreviewAnchorEditMove,
    onPreviewAnchorEditEnd,
    previewCueEditingId,
    onPreviewCueEditStart,
    onPreviewCueEditMove,
    onPreviewCueEditEnd,
    visualCutEditingId,
    onVisualCutEditStart,
    onVisualCutEditMove,
    onVisualCutEditEnd,
    onTogglePreviewAudio,
    onTogglePreviewFullscreen,
    onTogglePreviewLock,
}: {
    activeVisual: VisualClip | undefined;
    previewActiveVisual: VisualClip | undefined;
    activeCutCanvasId: number | null;
    playhead: number;
    canConfirmImageComposition: boolean;
    canvasSummaries: CutEditCanvasSummary[];
    canvasOptions: PreviewCanvasOption[];
    imageCompositionConfirmError: string | null;
    previewZoom: number;
    previewMode: PreviewMode;
    previewStripHeightPx: number;
    previewVisualSegments: PreviewScrollVisualSegment[];
    previewVisualClips: VisualClip[];
    selectedPreviewCanvasId: number | null;
    isConfirmingImageComposition: boolean;
    isAddingAnchor: boolean;
    isAddingCue: boolean;
    isAnchorPlacementMode: boolean;
    isCuePlacementMode: boolean;
    isPreviewAudioEnabled: boolean;
    isPreviewFullscreen: boolean;
    isPreviewLocked: boolean;
    isPlaying: boolean;
    effects: EffectId[];
    visualClips: VisualClip[];
    scrollEvents: ScrollEventClip[];
    cueTracks: CutEditCueTrack[];
    cuePlacementTrackId: string;
    focusedTrackId: string;
    playbackScrollEvents: PreviewScrollPositionEvent[];
    anchors: AnchorListItem[];
    selectedId: string;
    onImageCompositionConfirm: () => Promise<void> | void;
    onMediaDrop: (event: ReactDragEvent<HTMLElement>) => void;
    onOpenTrackModal: () => void;
    onPreviewModeChange: (mode: PreviewMode) => void;
    onPreviewStripHeightChange: (heightPx: number) => void;
    onPreviewVisualSegmentsChange: (segments: PreviewScrollVisualSegment[]) => void;
    onPreviewZoomChange: (zoom: number) => void;
    onPreviewZoomStep: (delta: number) => void;
    onSelectPreviewCanvas: (canvasId: number) => void;
    onSelectVisual: (clipId: string) => void;
    onSelectCutCanvas: (canvasId: number) => void;
    onFocusTrack: (trackId: string) => void;
    onSelectCue: (cueId: number) => void;
    onToggleAnchorPlacement: () => void;
    onToggleCuePlacement: () => void;
    onPlaceAnchor: (stripPositionPx: number, stripHeightPx: number) => Promise<void> | void;
    onPlaceCue: (stripPositionPx: number, stripHeightPx: number) => Promise<void> | void;
    onSelectAnchor: (anchorId: number) => void;
    onSelectScrollEvent: (clipId: string) => void;
    onTogglePreviewAudio: () => void;
    onTogglePreviewFullscreen: () => void;
    onTogglePreviewLock: () => void;
} & PreviewScrollPointerEditHandlers &
    PreviewAnchorPointerEditHandlers &
    PreviewCuePointerEditHandlers &
    VisualCutPointerEditHandlers) {
    const [canvasSize, setCanvasSize] = useState<PreviewCanvasSize>({
        width: DEFAULT_PREVIEW_CANVAS_WIDTH,
        height: DEFAULT_PREVIEW_CANVAS_HEIGHT,
    });
    const [canvasResize, setCanvasResize] = useState<PreviewCanvasResize | null>(null);
    const previewStripRef = useRef<HTMLDivElement | null>(null);
    const previewVideoRefs = useRef(new Map<string, HTMLVideoElement>());
    const selectedAnchor = anchors.find((anchor) => selectedId === getAnchorSelectionId(anchor.id));
    const isCutEditMode = previewMode === 'cutEdit';
    const renderedVisualClips = isCutEditMode ? visualClips : previewVisualClips;
    const displayActiveVisual = isCutEditMode ? activeVisual : previewActiveVisual;
    const previewCoordinateHeightPx = getPreviewCoordinateHeight(previewStripHeightPx);
    const previewViewportHeightPx = Math.max(1, Math.round(canvasSize.height * previewZoom) - 34);
    const previewPlayheadPixel = getPreviewPlayheadPixel(playhead, playbackScrollEvents, previewCoordinateHeightPx, previewVisualSegments);
    const playbackPreviewScrollOffsetPx = getPreviewScrollOffset({
        playhead,
        scrollEvents: playbackScrollEvents,
        stripHeightPx: previewCoordinateHeightPx,
        viewportHeightPx: previewViewportHeightPx,
        visualSegments: previewVisualSegments,
    });
    const selectedAnchorScrollOffsetPx = selectedAnchor
        ? getPreviewScrollOffsetForAnchor({
              canvasId: selectedAnchor.canvasId,
              index: selectedAnchor.index,
              position: selectedAnchor.position,
              stripHeightPx: previewCoordinateHeightPx,
              viewportHeightPx: previewViewportHeightPx,
              visualSegments: previewVisualSegments,
          })
        : undefined;
    const previewScrollOffsetPx = selectedAnchorScrollOffsetPx ?? playbackPreviewScrollOffsetPx;
    const activeFxNames = effects
        .map((effectId) => effectById.get(effectId)?.name ?? effectId)
        .filter(Boolean);
    useEffect(() => {
        if (isCutEditMode) {
            return;
        }

        const strip = previewStripRef.current;

        if (!strip) {
            return;
        }

        const updatePreviewStripMetrics = () => {
            const stripRect = strip.getBoundingClientRect();
            const nextHeight = getPreviewCoordinateHeight(stripRect.height);
            const cutElements = Array.from(strip.querySelectorAll<HTMLElement>('.odx-preview-cut'));
            const nextSegments = renderedVisualClips.map((clip, index) => {
                const cut = cutElements[index];
                const cutRect = cut?.getBoundingClientRect();

                return {
                    id: clip.id,
                    canvasId: clip.canvasId,
                    index: clip.index ?? index,
                    top: cutRect ? cutRect.top - stripRect.top : index * getPreviewCutHeight(renderedVisualClips.length, nextHeight),
                    height: cutRect ? cutRect.height : getPreviewCutHeight(renderedVisualClips.length, nextHeight),
                };
            });

            onPreviewStripHeightChange(nextHeight);
            onPreviewVisualSegmentsChange(nextSegments);
        };
        const resizeObserver = new ResizeObserver(updatePreviewStripMetrics);

        updatePreviewStripMetrics();
        resizeObserver.observe(strip);
        strip.querySelectorAll<HTMLElement>('.odx-preview-cut').forEach((cut) => resizeObserver.observe(cut));

        return () => {
            resizeObserver.disconnect();
        };
    }, [isCutEditMode, onPreviewStripHeightChange, onPreviewVisualSegmentsChange, renderedVisualClips]);

    useEffect(() => {
        syncPreviewVideoPlayback({
            clips: renderedVisualClips,
            isPlaying: isPlaying && !isCutEditMode,
            playhead,
            videos: previewVideoRefs.current,
        });
    }, [isCutEditMode, isPlaying, playhead, renderedVisualClips]);

    useEffect(
        () => () => {
            previewVideoRefs.current.forEach((video) => video.pause());
        },
        [],
    );

    const handlePreviewCanvasResizeStart = (event: ReactPointerEvent<HTMLElement>) => {
        if (isPreviewLocked) {
            return;
        }

        const wrap = event.currentTarget.closest('.odx-preview-wrap');

        if (!(wrap instanceof HTMLElement)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setCanvasResize({
            pointerStartX: event.clientX,
            pointerStartY: event.clientY,
            originalWidth: canvasSize.width,
            originalHeight: canvasSize.height,
            maxWidth: Math.max(MIN_PREVIEW_CANVAS_WIDTH, wrap.clientWidth - 68),
            maxHeight: Math.max(MIN_PREVIEW_CANVAS_HEIGHT, wrap.clientHeight - 40),
        });
    };

    const handlePreviewCanvasResizeMove = (event: ReactPointerEvent<HTMLElement>) => {
        if (!canvasResize || isPreviewLocked) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        setCanvasSize({
            width: clamp(canvasResize.originalWidth + (event.clientX - canvasResize.pointerStartX) / previewZoom, MIN_PREVIEW_CANVAS_WIDTH, canvasResize.maxWidth),
            height: clamp(canvasResize.originalHeight + (event.clientY - canvasResize.pointerStartY) / previewZoom, MIN_PREVIEW_CANVAS_HEIGHT, canvasResize.maxHeight),
        });
    };

    const handlePreviewCanvasResizeEnd = (event: ReactPointerEvent<HTMLElement>) => {
        if (!canvasResize) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        setCanvasResize(null);
    };

    return (
        <section className={`odx-stage odx-stage-${previewMode} ${canvasResize ? 'is-canvas-resizing' : ''} ${isPreviewFullscreen ? 'is-preview-fullscreen' : ''} ${isPreviewLocked ? 'is-preview-locked' : ''} ${isPreviewAudioEnabled ? '' : 'is-preview-muted'}`}>
            <div className="odx-stage-toolbar">
                <div className="odx-tool-segment" role="group" aria-label="프리뷰 모드">
                    {previewModeDefinitions.map((mode) => (
                        <button className={previewMode === mode.id ? 'is-active' : ''} key={mode.id} onClick={() => onPreviewModeChange(mode.id)} type="button">
                            {mode.label}
                        </button>
                    ))}
                </div>
                {!isCutEditMode ? (
                    <label className="odx-preview-canvas-select">
                        <span>캔버스</span>
                        <select
                            aria-label="미리보기 캔버스 선택"
                            disabled={canvasOptions.length === 0}
                            onChange={(event) => onSelectPreviewCanvas(Number(event.target.value))}
                            value={selectedPreviewCanvasId ?? ''}
                        >
                            {canvasOptions.length > 0 ? (
                                canvasOptions.map((canvas) => (
                                    <option key={canvas.id} value={canvas.id}>
                                        {canvas.label} · {canvas.mediaCount}개
                                    </option>
                                ))
                            ) : (
                                <option value="">캔버스 없음</option>
                            )}
                        </select>
                    </label>
                ) : null}
                <div className="odx-stage-meta">
                    <span>
                        비율 9:20 · FPS 30 · 현재 {displayActiveVisual?.label ?? '컷 없음'}
                    </span>
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
            {isCutEditMode ? (
                <CutEditWorkspace
                    activeCanvasId={activeCutCanvasId}
                    activeVisual={activeVisual}
                    anchors={anchors}
                    canConfirmImageComposition={canConfirmImageComposition}
                    canvasSummaries={canvasSummaries}
                    imageCompositionConfirmError={imageCompositionConfirmError}
                    isAddingAnchor={isAddingAnchor}
                    isAddingCue={isAddingCue}
                    isAnchorPlacementMode={isAnchorPlacementMode}
                    isCuePlacementMode={isCuePlacementMode}
                    isConfirmingImageComposition={isConfirmingImageComposition}
                    isPreviewLocked={isPreviewLocked}
                    cuePlacementTrackId={cuePlacementTrackId}
                    cueTracks={cueTracks}
                    focusedTrackId={focusedTrackId}
                    onFocusTrack={onFocusTrack}
                    onImageCompositionConfirm={onImageCompositionConfirm}
                    onMediaDrop={onMediaDrop}
                    onOpenTrackModal={onOpenTrackModal}
                    onPlaceAnchor={onPlaceAnchor}
                    onPlaceCue={onPlaceCue}
                    onPreviewAnchorEditEnd={onPreviewAnchorEditEnd}
                    onPreviewAnchorEditMove={onPreviewAnchorEditMove}
                    onPreviewAnchorEditStart={onPreviewAnchorEditStart}
                    onPreviewCueEditEnd={onPreviewCueEditEnd}
                    onPreviewCueEditMove={onPreviewCueEditMove}
                    onPreviewCueEditStart={onPreviewCueEditStart}
                    onPreviewScrollEditEnd={onPreviewScrollEditEnd}
                    onPreviewScrollEditMove={onPreviewScrollEditMove}
                    onPreviewScrollEditStart={onPreviewScrollEditStart}
                    onPreviewStripHeightChange={onPreviewStripHeightChange}
                    onPreviewVisualSegmentsChange={onPreviewVisualSegmentsChange}
                    onSelectAnchor={onSelectAnchor}
                    onSelectCanvas={onSelectCutCanvas}
                    onSelectCue={onSelectCue}
                    onSelectScrollEvent={onSelectScrollEvent}
                    onSelectVisual={onSelectVisual}
                    onToggleAnchorPlacement={onToggleAnchorPlacement}
                    onToggleCuePlacement={onToggleCuePlacement}
                    onVisualCutEditEnd={onVisualCutEditEnd}
                    onVisualCutEditMove={onVisualCutEditMove}
                    onVisualCutEditStart={onVisualCutEditStart}
                    playbackScrollEvents={playbackScrollEvents}
                    playhead={playhead}
                    previewAnchorEditingId={previewAnchorEditingId}
                    previewCueEditingId={previewCueEditingId}
                    previewScrollEditingId={previewScrollEditingId}
                    previewStripHeightPx={previewStripHeightPx}
                    previewVisualSegments={previewVisualSegments}
                    scrollEvents={scrollEvents}
                    selectedId={selectedId}
                    visualCutEditingId={visualCutEditingId}
                />
            ) : (
            <div className="odx-preview-wrap">
                <div
                    className="odx-canvas"
                    style={
                        {
                            '--odx-canvas-width': `${Math.round(canvasSize.width * previewZoom)}px`,
                            '--odx-canvas-height': `${Math.round(canvasSize.height * previewZoom)}px`,
                        } as CSSProperties
                    }
                >
                    <div className="odx-canvas-bar">
                        <div className="odx-canvas-title">
                            <span>이미지 스트립 PREVIEW</span>
                            <b>{formatTime(playhead)}</b>
                        </div>
                        <div className="odx-canvas-dots" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                        </div>
                    </div>
                    <div
                        className="odx-strip-scroll"
                        style={
                            {
                                transform: `translateY(-${previewScrollOffsetPx ?? 0}px)`,
                            } as CSSProperties
                        }
                    >
                        <div className="odx-webtoon-strip" ref={previewStripRef}>
                            {renderedVisualClips.length > 0 ? (
                                renderedVisualClips.map((clip, index) => (
                                    <article
                                        className={`odx-preview-cut ${clip.mediaUrl ? 'has-media' : ''} ${clip.id === displayActiveVisual?.id ? 'is-active' : ''} ${selectedId === clip.id ? 'is-selected' : ''}`}
                                        data-clip-id={clip.id}
                                        key={clip.id}
                                        style={getPreviewCutStyle(clip, renderedVisualClips.length, previewCoordinateHeightPx)}
                                    >
                                        {clip.mediaType === 'image' && clip.mediaUrl ? <img alt="" className="odx-preview-media" src={clip.mediaUrl} /> : null}
                                        {clip.mediaType === 'video' && clip.mediaUrl ? (
                                            <video
                                                className="odx-preview-media"
                                                playsInline
                                                preload="metadata"
                                                ref={(node) => {
                                                    if (node) {
                                                        previewVideoRefs.current.set(clip.id, node);
                                                    } else {
                                                        previewVideoRefs.current.delete(clip.id);
                                                    }
                                                }}
                                                src={clip.mediaUrl}
                                            />
                                        ) : null}
                                        {clip.mediaUrl ? null : <span>{clip.label}</span>}
                                        {clip.mediaUrl ? null : <strong>{clip.description}</strong>}
                                        {clip.bubble ? <p className={`odx-speech-bubble odx-speech-${clip.bubble.tone ?? 'default'}`}>{clip.bubble.text}</p> : null}
                                        {clip.subtitle ? <small>{clip.subtitle}</small> : null}
                                        {isCutEditMode ? (
                                            <button
                                                className={`odx-cut-edit-target ${visualCutEditingId === clip.id ? 'is-editing' : ''}`}
                                                onClick={() => onSelectVisual(clip.id)}
                                                onPointerCancel={onVisualCutEditEnd}
                                                onPointerDown={(pointerEvent) => {
                                                    if (isPreviewLocked) {
                                                        return;
                                                    }

                                                    onVisualCutEditStart({ event: pointerEvent, clip, index, mode: 'reorder' });
                                                }}
                                                onPointerMove={onVisualCutEditMove}
                                                onPointerUp={onVisualCutEditEnd}
                                                type="button"
                                            >
                                                <span>{String(index + 1).padStart(2, '0')}</span>
                                                <strong>{clip.label}</strong>
                                                <small>
                                                    {getVisualClipTimingLabel(clip)}
                                                </small>
                                                <i
                                                    aria-hidden="true"
                                                    className="odx-cut-duration-handle"
                                                    onPointerDown={(pointerEvent) => {
                                                        if (isPreviewLocked) {
                                                            return;
                                                        }

                                                        onVisualCutEditStart({ event: pointerEvent, clip, index, mode: 'duration' });
                                                    }}
                                                />
                                            </button>
                                        ) : null}
                                    </article>
                                ))
                            ) : (
                                <div className="odx-preview-empty">등록된 컷 미디어가 없습니다.</div>
                            )}
                        </div>
                        {previewPlayheadPixel !== undefined ? (
                            <div className="odx-strip-playhead" style={{ top: `${previewPlayheadPixel}px` }}>
                                <span>{formatTime(playhead)}</span>
                            </div>
                        ) : null}
                    </div>
                    <div className="odx-fx-overlay">
                        {activeFxNames.map((effectName) => (
                            <span className="odx-fx-pill" key={effectName}>
                                <i />
                                {effectName}
                            </span>
                        ))}
                    </div>
                    <span className="odx-canvas-size-tag">
                        {Math.round(canvasSize.width * previewZoom)} × {Math.round(canvasSize.height * previewZoom)}
                    </span>
                    <button
                        aria-label="미리보기 크기 조절"
                        className="odx-canvas-resize"
                        onPointerCancel={handlePreviewCanvasResizeEnd}
                        onPointerDown={handlePreviewCanvasResizeStart}
                        onPointerMove={handlePreviewCanvasResizeMove}
                        onPointerUp={handlePreviewCanvasResizeEnd}
                        title="드래그하여 미리보기 크기 조절"
                        type="button"
                    />
                </div>
                <div className="odx-preview-side">
                    <button
                        aria-label={isAddingAnchor ? '앵커 추가 중' : isAnchorPlacementMode ? '앵커 위치 선택 취소' : '앵커 추가'}
                        aria-pressed={isAnchorPlacementMode}
                        className={`odx-icon-btn ${isAnchorPlacementMode || isAddingAnchor ? 'is-active' : ''}`}
                        disabled={isPreviewLocked || isAddingAnchor}
                        onClick={onToggleAnchorPlacement}
                        title={
                            isPreviewLocked
                                ? '잠금 해제 후 앵커를 추가할 수 있습니다.'
                                : isAnchorPlacementMode
                                  ? '앵커 위치 선택 취소'
                                  : '이미지 스트립에서 앵커 위치 선택'
                        }
                        type="button"
                    >
                        <StudioIcon name="anchor" size={17} />
                    </button>
                    <button aria-label={isPreviewAudioEnabled ? '소리 끄기' : '소리 켜기'} aria-pressed={isPreviewAudioEnabled} className={`odx-icon-btn ${isPreviewAudioEnabled ? 'is-active' : ''}`} onClick={onTogglePreviewAudio} type="button">
                        <StudioIcon name="speaker" size={17} />
                    </button>
                    <button aria-label={isPreviewFullscreen ? '전체 화면 해제' : '전체 화면'} aria-pressed={isPreviewFullscreen} className={`odx-icon-btn ${isPreviewFullscreen ? 'is-active' : ''}`} onClick={onTogglePreviewFullscreen} type="button">
                        <StudioIcon name="fullscreen" size={17} />
                    </button>
                    <button aria-label={isPreviewLocked ? '잠금 해제' : '잠금'} aria-pressed={isPreviewLocked} className={`odx-icon-btn ${isPreviewLocked ? 'is-active' : ''}`} onClick={onTogglePreviewLock} type="button">
                        <StudioIcon name="lock" size={17} />
                    </button>
                </div>
            </div>
            )}
        </section>
    );
}

function InspectorPanel({
    selectedItem,
    effects,
    activeVisual,
    anchors,
    anchorEventDraft,
    trackById,
    characterById,
    previewStripHeightPx,
    previewVisualSegments,
    cueScriptState,
    onAnchorEventDraftChange,
    onSaveAnchorEvent,
    onDeleteAnchorEvent,
    onDeleteAnchor,
    onCueScriptDraftChange,
    onSaveCueScript,
    onUpdateVideoClipControls,
    onStepTimelineItem,
    onNudgeScrollPosition,
    onDeleteTimelineItem,
    onResizeStart,
}: {
    selectedItem: Selection | undefined;
    effects: EffectId[];
    activeVisual: VisualClip | undefined;
    anchors: AnchorListItem[];
    anchorEventDraft: AnchorEventDraft;
    trackById: Map<string, AudioTrackDefinition>;
    characterById: Map<string, CharacterDefinition>;
    previewStripHeightPx: number;
    previewVisualSegments: PreviewScrollVisualSegment[];
    cueScriptState: CueScriptPanelState;
    onAnchorEventDraftChange: (patch: Partial<Pick<AnchorEventDraft, 'type' | 'endAnchorId' | 'duration'>>) => void;
    onSaveAnchorEvent: () => Promise<void> | void;
    onDeleteAnchorEvent: () => Promise<void> | void;
    onDeleteAnchor: () => Promise<void> | void;
    onCueScriptDraftChange: (script: string) => void;
    onSaveCueScript: () => Promise<void> | void;
    onUpdateVideoClipControls: (clipId: string, patch: VideoClipControlPatch, options?: { persist?: boolean }) => void;
    onStepTimelineItem: (itemKind: TimelineItemKind, itemId: string, edge: 'start' | 'end', deltaSeconds: number) => void;
    onNudgeScrollPosition: (itemId: string, edge: 'start' | 'end', deltaPx: number) => void;
    onDeleteTimelineItem: (itemKind: TimelineItemKind, itemId: string) => void;
    onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
    const item = selectedItem ?? activeVisual;

    if (!item) {
        return (
            <aside className="odx-inspector">
                <button aria-label="인스펙터 폭 조절" className="odx-inspector-resize-boundary" onPointerDown={onResizeStart} type="button" />
                <div className="odx-inspector-head">
                    <p className="odx-eyebrow">INSPECTOR</p>
                    <h2>선택 없음</h2>
                </div>
                <div className="odx-inspector-body">
                    <section className="odx-inspector-card">
                        <p className="odx-empty-note">선택된 컷, 큐, 스크롤 이벤트가 없습니다.</p>
                    </section>
                </div>
            </aside>
        );
    }

    const isTimelineItem = isTimelineClip(item);
    const isAnchor = isAnchorSelection(item);
    const isScrollEvent = isScrollEventClip(item);
    const isAudioClip = isTimelineItem && !isScrollEvent;
    const visualItem = !isTimelineItem && !isAnchor ? item : undefined;
    const isVideoClip = visualItem?.mediaType === 'video';
    const character = isAudioClip && item.characterId ? characterById.get(item.characterId) : undefined;
    const itemTitle = isTimelineItem || isAnchor ? item.label : `${item.label} · ${item.description}`;
    const scrollStartPositionLabel = isScrollEvent ? formatScrollIndexedPosition(item.startIndex, item.startPosition) : '';
    const scrollEndPositionLabel = isScrollEvent ? formatScrollIndexedPosition(item.endIndex, item.endPosition) : '';
    const itemMeta = isAnchor
        ? `${trackById.get(item.trackId)?.label ?? `트랙 ${item.trackId}`} · ${item.sublabel}`
        : isScrollEvent
        ? `시간 ${formatTime(item.start)} · 위치 ${scrollStartPositionLabel} -> ${scrollEndPositionLabel}`
        : isAudioClip
          ? `${trackById.get(item.track)?.label ?? item.track}`
          : `캔버스 ${visualItem?.canvasId ?? '-'} · ${visualItem?.mediaType ?? visualItem?.kind ?? 'media'}`;
    const scrollStartPixel = isScrollEvent ? getScrollEventStartPixel(item, previewStripHeightPx, previewVisualSegments) : 0;
    const scrollEndPixel = isScrollEvent ? getScrollEventEndPixel(item, previewStripHeightPx, previewVisualSegments) : 0;
    const scrollDistance = isScrollEvent ? Math.abs(scrollEndPixel - scrollStartPixel) : 0;
    const scrollSpeed = isScrollEvent ? Math.round(scrollDistance / Math.max(1, item.duration)) : 0;
    const scrollStartTop = isScrollEvent ? clamp((scrollStartPixel / Math.max(1, previewStripHeightPx)) * 100, 0, 100) : 0;
    const scrollEndTop = isScrollEvent ? clamp((scrollEndPixel / Math.max(1, previewStripHeightPx)) * 100, 0, 100) : 0;
    const anchorEventEndOptions = isAnchor
        ? anchors.filter(
              (anchor) =>
                  String(anchor.trackId) === item.trackId &&
                  anchor.id !== item.anchorId &&
                  anchor.canvasId === item.canvasId &&
                  anchor.time > item.time,
          )
        : [];
    const anchorEventLabel =
        isAnchor && item.event?.type === 'scroll'
            ? `스크롤 · A${item.event.startAnchorId} -> A${item.event.endAnchorId}`
            : isAnchor && item.event?.type === 'pause'
              ? `정지 · ${Math.round(item.event.duration)}ms`
              : '이벤트 없음';
    const showAudioCueScript = isAudioClip && audioInspectorSectionIds.includes('cueScript');
    const showAudioTiming = isAudioClip && audioInspectorSectionIds.includes('timing');

    if (isAnchor) {
        return (
            <aside className="odx-inspector">
                <button aria-label="인스펙터 폭 조절" className="odx-inspector-resize-boundary" onPointerDown={onResizeStart} type="button" />
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
                                <dt>시간</dt>
                                <dd>{formatTime(toTimelineSeconds(item.time))}</dd>
                            </div>
                            <div>
                                <dt>트랙</dt>
                                <dd>{trackById.get(item.trackId)?.label ?? item.trackId}</dd>
                            </div>
                            <div>
                                <dt>캔버스</dt>
                                <dd>{item.canvasId}</dd>
                            </div>
                            <div>
                                <dt>위치</dt>
                                <dd>{formatScrollIndexedPosition(item.index, item.position)}</dd>
                            </div>
                        </dl>
                    </section>
                    <section className="odx-inspector-card">
                        <h3>앵커 위치</h3>
                        <div className="odx-scroll-geometry">
                            <div>
                                <span>media index</span>
                                <b>{item.index + 1}</b>
                            </div>
                            <div>
                                <span>media percent</span>
                                <b>{Math.round(item.position)}%</b>
                            </div>
                            <div>
                                <span>timeline</span>
                                <b>{formatTime(toTimelineSeconds(item.time))}</b>
                            </div>
                        </div>
                    </section>
                    <section className="odx-inspector-card">
                        <h3>앵커 이벤트</h3>
                        <div className="odx-anchor-event-summary">
                            <span>현재 이벤트</span>
                            <b>{anchorEventLabel}</b>
                        </div>
                        <form
                            className="odx-anchor-event-form"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void onSaveAnchorEvent();
                            }}
                        >
                            <div className="odx-anchor-event-toggle" role="group" aria-label="앵커 이벤트 유형">
                                <button
                                    className={anchorEventDraft.type === 'scroll' ? 'is-active' : ''}
                                    disabled={anchorEventDraft.isSaving}
                                    onClick={() => onAnchorEventDraftChange({ type: 'scroll' })}
                                    type="button"
                                >
                                    스크롤
                                </button>
                                <button
                                    className={anchorEventDraft.type === 'pause' ? 'is-active' : ''}
                                    disabled={anchorEventDraft.isSaving}
                                    onClick={() => onAnchorEventDraftChange({ type: 'pause' })}
                                    type="button"
                                >
                                    정지
                                </button>
                            </div>
                            {anchorEventDraft.type === 'scroll' ? (
                                <label className="odx-anchor-event-field">
                                    <span>종료 앵커</span>
                                    <select
                                        disabled={anchorEventDraft.isSaving || anchorEventEndOptions.length === 0}
                                        onChange={(event) => onAnchorEventDraftChange({ endAnchorId: event.currentTarget.value })}
                                        value={anchorEventDraft.endAnchorId}
                                    >
                                        <option value="">종료 앵커 선택</option>
                                        {anchorEventEndOptions.map((anchor) => (
                                            <option key={anchor.id} value={anchor.id}>
                                                {`A${anchor.id} · ${formatTime(toTimelineSeconds(anchor.time))} · ${formatScrollIndexedPosition(anchor.index, anchor.position)}`}
                                            </option>
                                        ))}
                                    </select>
                                    {anchorEventEndOptions.length === 0 ? <small>같은 캔버스에서 뒤쪽 앵커를 하나 더 추가해야 합니다.</small> : null}
                                </label>
                            ) : (
                                <label className="odx-anchor-event-field">
                                    <span>정지 시간(ms)</span>
                                    <input
                                        disabled={anchorEventDraft.isSaving}
                                        min="1"
                                        onChange={(event) => onAnchorEventDraftChange({ duration: event.currentTarget.value })}
                                        step="100"
                                        type="number"
                                        value={anchorEventDraft.duration}
                                    />
                                </label>
                            )}
                            {anchorEventDraft.error ? (
                                <p className="odx-cue-script-error" role="alert">
                                    {anchorEventDraft.error}
                                </p>
                            ) : null}
                            <div className="odx-anchor-event-actions">
                                <button disabled={anchorEventDraft.isSaving} type="submit">
                                    {anchorEventDraft.isSaving ? '저장 중' : '이벤트 저장'}
                                </button>
                                {item.event ? (
                                    <button disabled={anchorEventDraft.isSaving} onClick={() => void onDeleteAnchorEvent()} type="button">
                                        이벤트 삭제
                                    </button>
                                ) : null}
                            </div>
                        </form>
                    </section>
                    <section className="odx-inspector-actions">
                        <button className="odx-danger-action" disabled={anchorEventDraft.isSaving} onClick={() => void onDeleteAnchor()} type="button">
                            앵커 삭제
                        </button>
                    </section>
                </div>
            </aside>
        );
    }

    return (
        <aside className="odx-inspector">
            <button aria-label="인스펙터 폭 조절" className="odx-inspector-resize-boundary" onPointerDown={onResizeStart} type="button" />
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
                        {isTimelineItem ? (
                            <>
                                <div>
                                    <dt>시작</dt>
                                    <dd>{formatTime(item.start)}</dd>
                                </div>
                                <div>
                                    <dt>길이</dt>
                                    <dd>{item.duration.toFixed(1)}s</dd>
                                </div>
                            </>
                        ) : null}
                        {visualItem ? (
                            <>
                                <div>
                                    <dt>미디어 ID</dt>
                                    <dd>{visualItem.mediaId}</dd>
                                </div>
                                <div>
                                    <dt>기준</dt>
                                    <dd>{getVisualClipTimingLabel(visualItem)}</dd>
                                </div>
                            </>
                        ) : null}
                        {!isAudioClip && !visualItem ? (
                            <div>
                                <dt>상태</dt>
                                <dd>{effects.length > 0 ? '효과 적용' : '기본'}</dd>
                            </div>
                        ) : null}
                    </dl>
                </section>
                {isScrollEvent ? (
                    <section className="odx-inspector-card">
                        <h3>스크롤 구간</h3>
                        <div className="odx-scroll-path-card">
                            <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
                                <polyline points={`14,${scrollStartTop.toFixed(1)} 86,${scrollEndTop.toFixed(1)}`} />
                            </svg>
                            <span className="odx-scroll-path-dot odx-scroll-path-start" style={{ top: `${scrollStartTop}%` }}>
                                시작
                            </span>
                            <span className="odx-scroll-path-dot odx-scroll-path-end" style={{ top: `${scrollEndTop}%` }}>
                                종료
                            </span>
                        </div>
                        <div className="odx-inspector-step-grid">
                            <div className="odx-step-field">
                                <span>시작 시간</span>
                                <div className="odx-dur-step">
                                    <button onClick={() => onStepTimelineItem('scroll', item.id, 'start', -0.5)} type="button">
                                        -
                                    </button>
                                    <b>{formatTime(item.start)}</b>
                                    <button onClick={() => onStepTimelineItem('scroll', item.id, 'start', 0.5)} type="button">
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="odx-step-field">
                                <span>종료 시간</span>
                                <div className="odx-dur-step">
                                    <button onClick={() => onStepTimelineItem('scroll', item.id, 'end', -0.5)} type="button">
                                        -
                                    </button>
                                    <b>{formatTime(item.start + item.duration)}</b>
                                    <button onClick={() => onStepTimelineItem('scroll', item.id, 'end', 0.5)} type="button">
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="odx-step-field">
                                <span>시작 위치</span>
                                <div className="odx-dur-step">
                                    <button onClick={() => onNudgeScrollPosition(item.id, 'start', -SCROLL_POSITION_STEP_PX)} type="button">
                                        -
                                    </button>
                                    <b>{scrollStartPositionLabel}</b>
                                    <button onClick={() => onNudgeScrollPosition(item.id, 'start', SCROLL_POSITION_STEP_PX)} type="button">
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="odx-step-field">
                                <span>종료 위치</span>
                                <div className="odx-dur-step">
                                    <button onClick={() => onNudgeScrollPosition(item.id, 'end', -SCROLL_POSITION_STEP_PX)} type="button">
                                        -
                                    </button>
                                    <b>{scrollEndPositionLabel}</b>
                                    <button onClick={() => onNudgeScrollPosition(item.id, 'end', SCROLL_POSITION_STEP_PX)} type="button">
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                        <p className="odx-dur-hint">
                            길이 {item.duration.toFixed(1)}s · 이동 {Math.round(scrollDistance)}px · {scrollSpeed}px/s
                        </p>
                    </section>
                ) : null}
                {isAudioClip ? (
                    <section className="odx-inspector-card">
                        <h3>{character ? '보이스 큐' : '오디오 큐'}</h3>
                        {character ? (
                            <div className="odx-character-inspector">
                                <CharacterAvatar character={character} size="md" />
                                <span>
                                    <strong>{character.name}</strong>
                                    <small>{character.role} · {character.meta}</small>
                                </span>
                            </div>
                        ) : null}
                        <div className="odx-inspector-step-grid">
                            <div className="odx-step-field">
                                <span>시작 위치</span>
                                <b>{formatCueMediaPosition(item.startCanvasMediaId, item.startPosition)}</b>
                            </div>
                            <div className="odx-step-field">
                                <span>종료 위치</span>
                                <b>{formatCueMediaPosition(item.endCanvasMediaId ?? item.startCanvasMediaId, item.endPosition ?? item.startPosition)}</b>
                            </div>
                        </div>
                        {showAudioCueScript ? (
                            <form
                                className="odx-cue-script-form"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void onSaveCueScript();
                                }}
                            >
                                <label className="odx-cue-script-field">
                                    <span>대사</span>
                                    <textarea
                                        disabled={cueScriptState.isSaving}
                                        onChange={(event) => onCueScriptDraftChange(event.currentTarget.value)}
                                        placeholder="대사를 입력하세요"
                                        value={cueScriptState.draft}
                                    />
                                </label>
                                {cueScriptState.error ? (
                                    <p className="odx-cue-script-error" role="alert">
                                        {cueScriptState.error}
                                    </p>
                                ) : null}
                                <div className="odx-cue-script-actions">
                                    <button disabled={cueScriptState.isSaving || !cueScriptState.draft.trim()} type="submit">
                                        {cueScriptState.isSaving ? '등록 중' : '등록'}
                                    </button>
                                </div>
                            </form>
                        ) : null}
                        {showAudioTiming ? (
                            <div className="odx-inspector-step-grid">
                                <div className="odx-step-field">
                                    <span>시작</span>
                                    <div className="odx-dur-step">
                                        <button onClick={() => onStepTimelineItem('audio', item.id, 'start', -0.5)} type="button">
                                            -
                                        </button>
                                        <b>{formatTime(item.start)}</b>
                                        <button onClick={() => onStepTimelineItem('audio', item.id, 'start', 0.5)} type="button">
                                            +
                                        </button>
                                    </div>
                                </div>
                                <div className="odx-step-field">
                                    <span>종료</span>
                                    <div className="odx-dur-step">
                                        <button onClick={() => onStepTimelineItem('audio', item.id, 'end', -0.5)} type="button">
                                            -
                                        </button>
                                        <b>{formatTime(item.start + item.duration)}</b>
                                        <button onClick={() => onStepTimelineItem('audio', item.id, 'end', 0.5)} type="button">
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </section>
                ) : null}
                {visualItem ? (
                    <section className="odx-inspector-card">
                        <h3>캔버스 레이어</h3>
                        <div className="odx-inspector-step-grid">
                            <div className="odx-step-field">
                                <span>캔버스</span>
                                <b>{visualItem.canvasId ?? '-'}</b>
                            </div>
                            <div className="odx-step-field">
                                <span>순서</span>
                                <b>{typeof visualItem.index === 'number' ? visualItem.index + 1 : '-'}</b>
                            </div>
                            <div className="odx-step-field">
                                <span>미디어</span>
                                <b>{visualItem.mediaType ?? visualItem.kind}</b>
                            </div>
                        </div>
                    </section>
                ) : null}
                {isVideoClip ? (
                    <section className="odx-inspector-card">
                        <h3>비디오 타임라인</h3>
                        <div className="odx-inspector-step-grid">
                            <div className="odx-step-field">
                                <span>시작</span>
                                <div className="odx-dur-step">
                                    <button onClick={() => onStepTimelineItem('video', visualItem.id, 'start', -0.5)} type="button">
                                        -
                                    </button>
                                    <b>{formatTime(visualItem.start)}</b>
                                    <button onClick={() => onStepTimelineItem('video', visualItem.id, 'start', 0.5)} type="button">
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="odx-step-field">
                                <span>종료</span>
                                <div className="odx-dur-step">
                                    <button onClick={() => onStepTimelineItem('video', visualItem.id, 'end', -0.5)} type="button">
                                        -
                                    </button>
                                    <b>{formatTime(visualItem.start + visualItem.duration)}</b>
                                    <button onClick={() => onStepTimelineItem('video', visualItem.id, 'end', 0.5)} type="button">
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="odx-video-control-grid">
                            <label>
                                <span>원본 시작(s)</span>
                                <input
                                    min="0"
                                    onBlur={(event) =>
                                        onUpdateVideoClipControls(visualItem.id, { sourceStart: Number(event.currentTarget.value) }, { persist: true })
                                    }
                                    onChange={(event) => onUpdateVideoClipControls(visualItem.id, { sourceStart: Number(event.currentTarget.value) })}
                                    step="0.1"
                                    type="number"
                                    value={visualItem.sourceStart ?? 0}
                                />
                            </label>
                            <label>
                                <span>원본 종료(s)</span>
                                <input
                                    min="0"
                                    onBlur={(event) =>
                                        onUpdateVideoClipControls(visualItem.id, { sourceEnd: Number(event.currentTarget.value) }, { persist: true })
                                    }
                                    onChange={(event) => onUpdateVideoClipControls(visualItem.id, { sourceEnd: Number(event.currentTarget.value) })}
                                    step="0.1"
                                    type="number"
                                    value={visualItem.sourceEnd ?? ''}
                                />
                            </label>
                            <label>
                                <span>음량</span>
                                <input
                                    max="100"
                                    min="0"
                                    onChange={(event) =>
                                        onUpdateVideoClipControls(
                                            visualItem.id,
                                            { volume: Number(event.currentTarget.value) / 100 },
                                            { persist: true },
                                        )
                                    }
                                    step="1"
                                    type="range"
                                    value={Math.round((visualItem.volume ?? 1) * 100)}
                                />
                            </label>
                            <label className="odx-video-muted-toggle">
                                <span>뮤트</span>
                                <input
                                    checked={visualItem.isMuted === true}
                                    onChange={(event) =>
                                        onUpdateVideoClipControls(visualItem.id, { isMuted: event.currentTarget.checked }, { persist: true })
                                    }
                                    type="checkbox"
                                />
                            </label>
                        </div>
                    </section>
                ) : null}
                {effects.length > 0 || !isAudioClip ? (
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
                ) : null}
                {isScrollEvent ? (
                    <section className="odx-inspector-card">
                        <h3>프리뷰 스크롤 위치</h3>
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
                                <span>시작 위치</span>
                                <b>{scrollStartPositionLabel}</b>
                            </div>
                            <div>
                                <span>종료 위치</span>
                                <b>{scrollEndPositionLabel}</b>
                            </div>
                        </div>
                    </section>
                ) : null}
                {isScrollEvent || isAudioClip ? (
                    <section className="odx-inspector-actions">
                        <button className="odx-danger-action" onClick={() => onDeleteTimelineItem(isScrollEvent ? 'scroll' : 'audio', item.id)} type="button">
                            {isScrollEvent ? '이벤트 삭제' : '큐 삭제'}
                        </button>
                    </section>
                ) : null}
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
    track,
    scrollEvents,
    pxPerSecond,
    selectedId,
    rangeSelectionIds,
    timelineTool,
    effectsById,
    onSelect,
    onSplitTimelineItem,
    onSelectTimelineRange,
    draggingItemId,
    onTimelinePointerEditStart,
    onTimelinePointerEditMove,
    onTimelinePointerEditEnd,
}: {
    track: AudioTrackDefinition;
    scrollEvents: ScrollEventClip[];
    pxPerSecond: number;
    selectedId: string;
    rangeSelectionIds: ReadonlySet<string>;
    timelineTool: TimelineToolMode;
    effectsById: Record<string, EffectId[]>;
    onSelect: (clipId: string) => void;
    onSplitTimelineItem: (itemKind: TimelineItemKind, itemId: string) => void;
    onSelectTimelineRange: (itemId: string, direction: 'left' | 'right') => void;
} & TimelinePointerEditHandlers) {
    const trackScrollEvents = scrollEvents.filter((event) => event.track === track.id);

    return (
        <div className="odx-visual-track" style={{ height: `${TIMELINE_TRACK_HEIGHT}px` }}>
            {trackScrollEvents.map((event) => {
                const effects = getItemEffects(event, effectsById);
                const handleClick = () => {
                    if (timelineTool === 'split') {
                        onSplitTimelineItem('scroll', event.id);
                        return;
                    }

                    if (timelineTool === 'selectL' || timelineTool === 'selectR') {
                        onSelectTimelineRange(event.id, timelineTool === 'selectL' ? 'left' : 'right');
                        return;
                    }

                    onSelect(event.id);
                };

                return (
                    <button
                        className={`odx-scroll-event-clip ${event.id === selectedId ? 'is-selected' : ''} ${rangeSelectionIds.has(event.id) ? 'is-range' : ''} ${draggingItemId === event.id ? 'is-dragging' : ''}`}
                        data-testid={`odx-clip-${event.id}`}
                        key={event.id}
                        onClick={handleClick}
                        onPointerCancel={onTimelinePointerEditEnd}
                        onPointerDown={(pointerEvent) => {
                            if (timelineTool !== 'select') {
                                return;
                            }

                            onTimelinePointerEditStart({ event: pointerEvent, itemKind: 'scroll', item: event, mode: 'move' });
                        }}
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
    scrollEvents,
    characterById,
    pxPerSecond,
    contentSeconds,
    selectedId,
    rangeSelectionIds,
    mutedTrackIds,
    soloTrackIds,
    lockedTrackIds,
    timelineTool,
    effectsById,
    playhead,
    onSelect,
    onSplitTimelineItem,
    onSelectTimelineRange,
    onDropAudioOnTrack,
    draggingItemId,
    onTimelinePointerEditStart,
    onTimelinePointerEditMove,
    onTimelinePointerEditEnd,
}: {
    audioTracks: AudioTrackDefinition[];
    timelineClips: TimelineClip[];
    scrollEvents: ScrollEventClip[];
    characterById: Map<string, CharacterDefinition>;
    pxPerSecond: number;
    contentSeconds: number;
    selectedId: string;
    rangeSelectionIds: ReadonlySet<string>;
    mutedTrackIds: ReadonlySet<string>;
    soloTrackIds: ReadonlySet<string>;
    lockedTrackIds: ReadonlySet<string>;
    timelineTool: TimelineToolMode;
    effectsById: Record<string, EffectId[]>;
    playhead: number;
    onSelect: (clipId: string) => void;
    onSplitTimelineItem: (itemKind: TimelineItemKind, itemId: string) => void;
    onSelectTimelineRange: (itemId: string, direction: 'left' | 'right') => void;
    onDropAudioOnTrack: (trackId: string, seconds: number, audioId: number) => void;
} & TimelinePointerEditHandlers) {
    return (
        <>
            {audioTracks.map((track) => {
                if (isScrollTrackKind(track.kind)) {
                    return (
                        <VisualTrack
                            draggingItemId={draggingItemId}
                            effectsById={effectsById}
                            key={track.id}
                            onSelectTimelineRange={onSelectTimelineRange}
                            onSelect={onSelect}
                            onSplitTimelineItem={onSplitTimelineItem}
                            onTimelinePointerEditEnd={onTimelinePointerEditEnd}
                            onTimelinePointerEditMove={onTimelinePointerEditMove}
                            onTimelinePointerEditStart={onTimelinePointerEditStart}
                            pxPerSecond={pxPerSecond}
                            rangeSelectionIds={rangeSelectionIds}
                            scrollEvents={scrollEvents}
                            selectedId={selectedId}
                            timelineTool={timelineTool}
                            track={track}
                        />
                    );
                }

                const clips = timelineClips.filter((clip) => clip.track === track.id);
                const isMuted = mutedTrackIds.has(track.id);
                const isSoloDimmed = soloTrackIds.size > 0 && !soloTrackIds.has(track.id);
                const isLocked = lockedTrackIds.has(track.id);
                const canDropAudio = !isLocked;

                return (
                    <div
                        className={`odx-track-lane ${isMuted ? 'is-muted' : ''} ${isSoloDimmed ? 'is-solo-dimmed' : ''} ${isLocked ? 'is-locked' : ''}`}
                        key={track.id}
                        onDragOver={(event) => {
                            if (!canDropAudio) return;

                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'copy';
                        }}
                        onDrop={(event) => {
                            const droppedAudioId = Number(event.dataTransfer.getData(AUDIO_DRAG_MIME));
                            if (!canDropAudio || !Number.isFinite(droppedAudioId) || droppedAudioId <= 0) return;

                            event.preventDefault();
                            onDropAudioOnTrack(
                                track.id,
                                getTimelinePointerSeconds(event.currentTarget, event.clientX, pxPerSecond, contentSeconds),
                                droppedAudioId,
                            );
                        }}
                        style={{ height: `${TIMELINE_TRACK_HEIGHT}px` }}
                    >
                        {clips.map((clip) => {
                            const character = clip.characterId ? characterById.get(clip.characterId) : undefined;
                            const effects = getItemEffects(clip, effectsById);
                            const isClipPlaying = getCuePlaybackProgressLabel(clip, playhead) !== null;
                            const handleClick = () => {
                                if (timelineTool === 'split') {
                                    if (isLocked) {
                                        return;
                                    }

                                    onSplitTimelineItem('audio', clip.id);
                                    return;
                                }

                                if (timelineTool === 'selectL' || timelineTool === 'selectR') {
                                    onSelectTimelineRange(clip.id, timelineTool === 'selectL' ? 'left' : 'right');
                                    return;
                                }

                                onSelect(clip.id);
                            };

                            return (
                                <button
                                    className={`odx-audio-clip ${clip.id === selectedId ? 'is-selected' : ''} ${rangeSelectionIds.has(clip.id) ? 'is-range' : ''} ${draggingItemId === clip.id ? 'is-dragging' : ''} ${isClipPlaying ? 'is-playing' : ''}`}
                                    data-testid={`odx-clip-${clip.id}`}
                                    key={clip.id}
                                    onClick={handleClick}
                                    onPointerCancel={onTimelinePointerEditEnd}
                                    onPointerDown={(event) => {
                                        if (timelineTool !== 'select' || isLocked) {
                                            return;
                                        }

                                        onTimelinePointerEditStart({ event, itemKind: 'audio', item: clip, mode: 'move' });
                                    }}
                                    onPointerMove={onTimelinePointerEditMove}
                                    onPointerUp={onTimelinePointerEditEnd}
                                    style={{
                                        ...getClipStyle(clip.start, clip.duration, pxPerSecond),
                                        '--odx-clip-bg': getTrackBackground(track),
                                        '--odx-clip-accent': character?.color ?? track.color ?? '#93a4b8',
                                    } as CSSProperties}
                                    type="button"
                                >
                                    {isLocked ? null : <TimelineResizeHandles item={clip} itemKind="audio" onTimelinePointerEditStart={onTimelinePointerEditStart} />}
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

function VideoTrackLane({
    videoClips,
    pxPerSecond,
    selectedId,
    draggingItemId,
    playhead,
    timelineTool,
    onSelect,
    onTimelinePointerEditStart,
    onTimelinePointerEditMove,
    onTimelinePointerEditEnd,
}: {
    videoClips: VisualClip[];
    pxPerSecond: number;
    selectedId: string;
    draggingItemId: string | null;
    playhead: number;
    timelineTool: TimelineToolMode;
    onSelect: (clipId: string) => void;
} & TimelinePointerEditHandlers) {
    if (videoClips.length === 0) {
        return null;
    }

    return (
        <div className="odx-track-lane odx-video-track-lane" style={{ height: `${TIMELINE_TRACK_HEIGHT}px` }}>
            {videoClips.map((clip) => {
                const isClipPlaying = playhead >= clip.start && playhead < clip.start + clip.duration;

                return (
                    <button
                        className={`odx-audio-clip odx-video-timeline-clip ${clip.id === selectedId ? 'is-selected' : ''} ${draggingItemId === clip.id ? 'is-dragging' : ''} ${isClipPlaying ? 'is-playing' : ''}`}
                        data-testid={`odx-video-clip-${clip.id}`}
                        key={clip.id}
                        onClick={() => onSelect(clip.id)}
                        onPointerCancel={onTimelinePointerEditEnd}
                        onPointerDown={(event) => {
                            if (timelineTool !== 'select') {
                                return;
                            }

                            onTimelinePointerEditStart({ event, itemKind: 'video', item: clip, mode: 'move' });
                        }}
                        onPointerMove={onTimelinePointerEditMove}
                        onPointerUp={onTimelinePointerEditEnd}
                        style={{
                            ...getClipStyle(clip.start, clip.duration, pxPerSecond),
                            '--odx-clip-bg': 'linear-gradient(135deg, rgba(34, 197, 94, .28), rgba(20, 184, 166, .12))',
                            '--odx-clip-accent': '#34d399',
                        } as CSSProperties}
                        type="button"
                    >
                        <TimelineResizeHandles item={clip} itemKind="video" onTimelinePointerEditStart={onTimelinePointerEditStart} />
                        <span className="odx-clip-title">{clip.label}</span>
                        <span className="odx-clip-meta">
                            {formatTime(clip.start)} · {clip.duration.toFixed(1)}s · vol {Math.round((clip.volume ?? 1) * 100)}%
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function Timeline({
    audioTracks,
    timelineClips,
    videoClips,
    scrollEvents,
    anchors,
    trackLoadError,
    characterById,
    timelineHeight,
    timelineSidebarWidth,
    isTimelineHeightResizing,
    isTimelineSidebarResizing,
    durationSeconds,
    playhead,
    pxPerSecond,
    selectedId,
    focusedTrackId,
    rangeSelectionIds,
    mutedTrackIds,
    soloTrackIds,
    lockedTrackIds,
    trackContextMenu,
    deletingTrackId,
    timelineTool,
    isSnapEnabled,
    effectsById,
    onSelect,
    onFocusTrack,
    onOpenTrackContextMenu,
    onCloseTrackContextMenu,
    onDeleteTrack,
    onScrub,
    onSelectAnchor,
    onAddCue,
    onOpenTrackModal,
    onTimelineToolChange,
    onToggleSnap,
    onToggleTrackMute,
    onToggleTrackSolo,
    onToggleTrackLock,
    onSplitTimelineItem,
    onSelectTimelineRange,
    onDropAudioOnTrack,
    onTimelineZoomChange,
    onTimelineZoomStep,
    draggingItemId,
    onTimelinePointerEditStart,
    onTimelinePointerEditMove,
    onTimelinePointerEditEnd,
    timelineAnchorEditingId,
    onTimelineAnchorEditStart,
    onTimelineAnchorEditMove,
    onTimelineAnchorEditEnd,
    onTimelineHeightResizeStart,
    onTimelineSidebarResizeStart,
}: {
    audioTracks: AudioTrackDefinition[];
    timelineClips: TimelineClip[];
    videoClips: VisualClip[];
    scrollEvents: ScrollEventClip[];
    anchors: AnchorListItem[];
    trackLoadError: string | null;
    characterById: Map<string, CharacterDefinition>;
    playhead: number;
    pxPerSecond: number;
    selectedId: string;
    focusedTrackId: string;
    rangeSelectionIds: string[];
    mutedTrackIds: string[];
    soloTrackIds: string[];
    lockedTrackIds: string[];
    trackContextMenu: TrackContextMenuState | null;
    deletingTrackId: string | null;
    timelineTool: TimelineToolMode;
    isSnapEnabled: boolean;
    effectsById: Record<string, EffectId[]>;
    onSelect: (clipId: string) => void;
    onFocusTrack: (trackId: string) => void;
    onOpenTrackContextMenu: (event: ReactMouseEvent<HTMLElement>, track: AudioTrackDefinition) => void;
    onCloseTrackContextMenu: () => void;
    onDeleteTrack: (trackId: string) => Promise<void>;
    onScrub: (seconds: number) => void;
    onSelectAnchor: (anchorId: number) => void;
    onAddCue: () => Promise<void> | void;
    onOpenTrackModal: () => void;
    onTimelineToolChange: (tool: TimelineToolMode) => void;
    onToggleSnap: () => void;
    onToggleTrackMute: (trackId: string) => void;
    onToggleTrackSolo: (trackId: string) => void;
    onToggleTrackLock: (trackId: string) => void;
    onSplitTimelineItem: (itemKind: TimelineItemKind, itemId: string) => void;
    onSelectTimelineRange: (itemId: string, direction: 'left' | 'right') => void;
    onDropAudioOnTrack: (trackId: string, seconds: number, audioId: number) => void;
    onTimelineZoomChange: (pxPerSecond: number) => void;
    onTimelineZoomStep: (delta: number) => void;
    durationSeconds: number;
} & TimelinePointerEditHandlers & TimelineAnchorPointerEditHandlers & TimelinePanelResizeHandlers) {
    const timelineScrollRef = useRef<HTMLDivElement | null>(null);
    const timelineScrubbingRef = useRef(false);
    const [isToolMenuOpen, setIsToolMenuOpen] = useState(false);
    const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
    const rangeSelectionSet = useMemo(() => new Set(rangeSelectionIds), [rangeSelectionIds]);
    const mutedTrackSet = useMemo(() => new Set(mutedTrackIds), [mutedTrackIds]);
    const soloTrackSet = useMemo(() => new Set(soloTrackIds), [soloTrackIds]);
    const lockedTrackSet = useMemo(() => new Set(lockedTrackIds), [lockedTrackIds]);
    const activeTimelineTool = timelineToolDefinitions.find((tool) => tool.id === timelineTool) ?? timelineToolDefinitions[0];
    const hasVideoTrack = videoClips.length > 0;
    const timelineTrackCount = audioTracks.length + (hasVideoTrack ? 1 : 0);
    const visibleSeconds = timelineViewportWidth > 0 ? Math.ceil(timelineViewportWidth / pxPerSecond) : durationSeconds;
    const contentSeconds = Math.max(durationSeconds, visibleSeconds);
    const ticks = getTimelineTicks(contentSeconds, pxPerSecond);
    const gridlines = ticks.filter((tick) => tick.kind !== 'minor');
    const contentWidth = Math.max(1, Math.ceil(contentSeconds * pxPerSecond));
    const rulerStyle = { width: `${contentWidth}px` };
    const gridStep = getTimelineGridStep(pxPerSecond);
    const zoomPercent = Math.round((pxPerSecond / DEFAULT_PX_PER_SECOND) * 100);
    const activeCuePlaybackProgress = getActiveCuePlaybackProgressLabel(timelineClips, playhead, selectedId);
    useEffect(() => {
        const timelineScroll = timelineScrollRef.current;

        if (!timelineScroll) {
            return undefined;
        }

        const updateTimelineViewportWidth = () => {
            setTimelineViewportWidth(timelineScroll.clientWidth);
        };

        updateTimelineViewportWidth();

        const observer = new ResizeObserver(updateTimelineViewportWidth);
        observer.observe(timelineScroll);

        return () => observer.disconnect();
    }, []);

    const scrubTimelinePointer = (event: ReactPointerEvent<HTMLElement>) => {
        onScrub(getTimelinePointerSeconds(event.currentTarget, event.clientX, pxPerSecond, contentSeconds));
    };

    const handleTimelineScrubStart = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        timelineScrubbingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        scrubTimelinePointer(event);
    };

    const handleTimelineScrubMove = (event: ReactPointerEvent<HTMLElement>) => {
        if (!timelineScrubbingRef.current) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        scrubTimelinePointer(event);
    };

    const handleTimelineScrubEnd = (event: ReactPointerEvent<HTMLElement>) => {
        if (!timelineScrubbingRef.current) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        timelineScrubbingRef.current = false;
    };

    return (
        <section
            className={`odx-timeline ${isTimelineHeightResizing ? 'is-height-resizing' : ''} ${isTimelineSidebarResizing ? 'is-sidebar-resizing' : ''}`}
            style={{ '--odx-timeline-sidebar-width': `${timelineSidebarWidth}px` } as CSSProperties}
        >
            <div
                aria-label="타임라인 높이 조절"
                aria-orientation="horizontal"
                aria-valuemax={MAX_TIMELINE_PANEL_HEIGHT}
                aria-valuemin={MIN_TIMELINE_PANEL_HEIGHT}
                aria-valuenow={timelineHeight}
                className="odx-timeline-resize-boundary"
                onPointerDown={onTimelineHeightResizeStart}
                role="separator"
                tabIndex={0}
            />
            <div
                aria-label="트랙 헤더 폭 조절"
                aria-orientation="vertical"
                aria-valuemax={MAX_TIMELINE_SIDEBAR_WIDTH}
                aria-valuemin={MIN_TIMELINE_SIDEBAR_WIDTH}
                aria-valuenow={timelineSidebarWidth}
                className="odx-timeline-sidebar-resize-boundary"
                onPointerDown={onTimelineSidebarResizeStart}
                role="separator"
                tabIndex={0}
            />
            <div className="odx-timeline-toolbar">
                <div className={`odx-tool-dropdown ${isToolMenuOpen ? 'is-open' : ''}`}>
                    <button
                        aria-expanded={isToolMenuOpen}
                        aria-haspopup="menu"
                        className="odx-tool-trigger"
                        onClick={() => setIsToolMenuOpen((current) => !current)}
                        title={`도구: ${activeTimelineTool.label}`}
                        type="button"
                    >
                        <span className="odx-tool-trigger-icon">
                            <StudioIcon name={activeTimelineTool.icon} size={17} />
                        </span>
                        <span className="odx-tool-caret" aria-hidden="true">
                            ▾
                        </span>
                    </button>
                    <div className="odx-tool-menu" hidden={!isToolMenuOpen} role="menu">
                        {timelineToolDefinitions.map((tool) => (
                            <button
                                className={`odx-tool-menu-item ${timelineTool === tool.id ? 'is-active' : ''}`}
                                key={tool.id}
                                onClick={() => {
                                    onTimelineToolChange(tool.id);
                                    setIsToolMenuOpen(false);
                                }}
                                role="menuitem"
                                type="button"
                            >
                                <span className="odx-tool-menu-icon">
                                    <StudioIcon name={tool.icon} size={18} />
                                </span>
                                <span>{tool.label}</span>
                                <kbd>{tool.key}</kbd>
                            </button>
                        ))}
                    </div>
                </div>
                <span className="odx-timeline-title">
                    타임라인 <b>{timelineTrackCount}</b> 트랙 · 길이 {formatTime(durationSeconds)}
                </span>
                {trackLoadError ? (
                    <span className="odx-timeline-error" role="alert">
                        {trackLoadError}
                    </span>
                ) : null}
                <div className="odx-timeline-action-row">
                    <button className="odx-timeline-action" onClick={() => void onAddCue()} type="button">
                        <StudioIcon name="plus" size={13} />
                        큐
                    </button>
                    <button className={`odx-snap-pill ${isSnapEnabled ? 'is-active' : ''}`} onClick={onToggleSnap} type="button">
                        스냅
                    </button>
                    <div className="odx-timeline-zoom" role="group" aria-label="타임라인 간격 조절">
                        <button aria-label="타임라인 축소" onClick={() => onTimelineZoomStep(-6)} type="button">
                            <span className="odx-zoom-lens" aria-hidden="true">
                                <StudioIcon name="search" size={14} />
                                <i>-</i>
                            </span>
                        </button>
                        <input
                            aria-label="타임라인 간격"
                            aria-valuetext={`${pxPerSecond} px/s, ${zoomPercent}%, 1칸 ${formatTimelineGridStep(gridStep)}`}
                            max={MAX_PX_PER_SECOND}
                            min={MIN_PX_PER_SECOND}
                            onChange={(event) => onTimelineZoomChange(Number(event.target.value))}
                            step={0.1}
                            type="range"
                            value={pxPerSecond}
                        />
                        <button aria-label="타임라인 확대" onClick={() => onTimelineZoomStep(6)} type="button">
                            <span className="odx-zoom-lens" aria-hidden="true">
                                <StudioIcon name="search" size={14} />
                                <i>+</i>
                            </span>
                        </button>
                        <span className="odx-zoom-value">1칸 {formatTimelineGridStep(gridStep)}</span>
                    </div>
                </div>
            </div>
            <div
                className="odx-timeline-left"
                style={{
                    gridTemplateRows: `28px repeat(${timelineTrackCount}, ${TIMELINE_TRACK_HEIGHT}px) 44px`,
                }}
            >
                <div className="odx-track-ruler-spacer" aria-hidden="true" />
                {hasVideoTrack ? (
                    <div
                        aria-pressed={focusedTrackId === VIDEO_TIMELINE_TRACK_ID}
                        className={`odx-track-header odx-video-track-header ${focusedTrackId === VIDEO_TIMELINE_TRACK_ID ? 'is-focused' : ''}`}
                        onClick={() => onFocusTrack(VIDEO_TIMELINE_TRACK_ID)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onFocusTrack(VIDEO_TIMELINE_TRACK_ID);
                            }
                        }}
                        role="button"
                        tabIndex={0}
                    >
                        <StudioIcon name="play" size={15} />
                        <span>비디오</span>
                        <small>VIDEO · {videoClips.length}개</small>
                    </div>
                ) : null}
                {audioTracks.map((track) => {
                    const isMuted = mutedTrackSet.has(track.id);
                    const isSolo = soloTrackSet.has(track.id);
                    const isLocked = lockedTrackSet.has(track.id);
                    const isFocused = focusedTrackId === track.id;

                    return (
                        <div
                            aria-pressed={isFocused}
                            className={`odx-track-header ${isFocused ? 'is-focused' : ''} ${isMuted ? 'is-muted' : ''} ${isSolo ? 'is-solo' : ''} ${isLocked ? 'is-locked' : ''}`}
                            key={track.id}
                            onClick={() => onFocusTrack(track.id)}
                            onContextMenu={(event) => onOpenTrackContextMenu(event, track)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onFocusTrack(track.id);
                                }
                            }}
                            role="button"
                            tabIndex={0}
                        >
                            <StudioIcon name={track.icon} size={15} />
                            <span>{track.label}</span>
                            <small>{track.sublabel}</small>
                            <span className="odx-track-toggle-row">
                                <button
                                    aria-pressed={isMuted}
                                    className={isMuted ? 'is-active' : ''}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onToggleTrackMute(track.id);
                                    }}
                                    onKeyDown={(event) => event.stopPropagation()}
                                    title={`${track.label} mute`}
                                    type="button"
                                >
                                    M
                                </button>
                                <button
                                    aria-pressed={isSolo}
                                    className={isSolo ? 'is-active' : ''}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onToggleTrackSolo(track.id);
                                    }}
                                    onKeyDown={(event) => event.stopPropagation()}
                                    title={`${track.label} solo`}
                                    type="button"
                                >
                                    S
                                </button>
                                <button
                                    aria-pressed={isLocked}
                                    className={isLocked ? 'is-active' : ''}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onToggleTrackLock(track.id);
                                    }}
                                    onKeyDown={(event) => event.stopPropagation()}
                                    title={`${track.label} lock`}
                                    type="button"
                                >
                                    L
                                </button>
                            </span>
                        </div>
                    );
                })}
                <button className="odx-add-track" onClick={onOpenTrackModal} type="button">
                    <StudioIcon name="plus" size={14} />
                    트랙 추가
                </button>
                {trackContextMenu ? (
                    <>
                        <button aria-label="트랙 메뉴 닫기" className="odx-track-context-backdrop" onClick={onCloseTrackContextMenu} type="button" />
                        <div className="odx-track-context-menu" role="menu" style={{ left: trackContextMenu.x, top: trackContextMenu.y }}>
                            <button
                                disabled={deletingTrackId === trackContextMenu.trackId}
                                onClick={() => void onDeleteTrack(trackContextMenu.trackId)}
                                role="menuitem"
                                title={`${trackContextMenu.trackLabel} 삭제`}
                                type="button"
                            >
                                {deletingTrackId === trackContextMenu.trackId ? '삭제 중...' : '트랙 삭제'}
                            </button>
                        </div>
                    </>
                ) : null}
            </div>
            <div className="odx-timeline-scroll" ref={timelineScrollRef}>
                <div className="odx-ruler" style={rulerStyle}>
                    <button
                        aria-label="타임라인 재생 위치 이동"
                        className="odx-ruler-scrub"
                        onPointerCancel={handleTimelineScrubEnd}
                        onPointerDown={handleTimelineScrubStart}
                        onPointerMove={handleTimelineScrubMove}
                        onPointerUp={handleTimelineScrubEnd}
                        type="button"
                    />
                    {ticks.map((tick) => (
                        <span
                            aria-hidden="true"
                            className={`odx-ruler-tick is-${tick.kind}`}
                            key={`${tick.kind}-${tick.time}`}
                            style={{ left: `${tick.time * pxPerSecond}px` }}
                        >
                            {tick.kind === 'major' ? <span>{formatTime(tick.time)}</span> : null}
                        </span>
                    ))}
                </div>
                <div className="odx-track-stack" style={{ width: `${contentWidth}px` }}>
                    <div className="odx-track-gridlines" aria-hidden="true">
                        {gridlines.map((tick) => (
                            <span className={`odx-track-gridline is-${tick.kind}`} key={`${tick.kind}-${tick.time}`} style={{ left: `${tick.time * pxPerSecond}px` }} />
                        ))}
                    </div>
                    <div className="odx-timeline-anchor-layer" aria-label="앵커 마커">
                        {anchors.map((anchor) => (
                            <button
                                aria-label={`앵커 ${anchor.id}`}
                                className={`odx-timeline-anchor-marker ${selectedId === getAnchorSelectionId(anchor.id) ? 'is-selected' : ''} ${timelineAnchorEditingId === anchor.id ? 'is-dragging' : ''}`}
                                key={anchor.id}
                                onClick={() => onSelectAnchor(anchor.id)}
                                onPointerCancel={onTimelineAnchorEditEnd}
                                onPointerDown={(event) => {
                                    if (event.button !== 0) {
                                        return;
                                    }

                                    onTimelineAnchorEditStart({ event, anchor });
                                }}
                                onPointerMove={onTimelineAnchorEditMove}
                                onPointerUp={onTimelineAnchorEditEnd}
                                style={{ left: `${toTimelineSeconds(anchor.time) * pxPerSecond}px` }}
                                title={`A${anchor.id} · ${formatTime(toTimelineSeconds(anchor.time))}`}
                                type="button"
                            >
                                <b>A{anchor.id}</b>
                            </button>
                        ))}
                    </div>
                    <VideoTrackLane
                        draggingItemId={draggingItemId}
                        onSelect={onSelect}
                        onTimelinePointerEditEnd={onTimelinePointerEditEnd}
                        onTimelinePointerEditMove={onTimelinePointerEditMove}
                        onTimelinePointerEditStart={onTimelinePointerEditStart}
                        playhead={playhead}
                        pxPerSecond={pxPerSecond}
                        selectedId={selectedId}
                        timelineTool={timelineTool}
                        videoClips={videoClips}
                    />
                    <AudioTracks
                        audioTracks={audioTracks}
                        characterById={characterById}
                        contentSeconds={contentSeconds}
                        draggingItemId={draggingItemId}
                        effectsById={effectsById}
                        lockedTrackIds={lockedTrackSet}
                        mutedTrackIds={mutedTrackSet}
                        onSelectTimelineRange={onSelectTimelineRange}
                        onSelect={onSelect}
                        onDropAudioOnTrack={onDropAudioOnTrack}
                        onSplitTimelineItem={onSplitTimelineItem}
                        onTimelinePointerEditEnd={onTimelinePointerEditEnd}
                        onTimelinePointerEditMove={onTimelinePointerEditMove}
                        onTimelinePointerEditStart={onTimelinePointerEditStart}
                        playhead={playhead}
                        pxPerSecond={pxPerSecond}
                        rangeSelectionIds={rangeSelectionSet}
                        selectedId={selectedId}
                        soloTrackIds={soloTrackSet}
                        scrollEvents={scrollEvents}
                        timelineClips={timelineClips}
                        timelineTool={timelineTool}
                    />
                    <div
                        aria-label="플레이헤드 위치"
                        aria-valuemax={contentSeconds}
                        aria-valuemin={0}
                        aria-valuenow={playhead}
                        className="odx-playhead"
                        onPointerCancel={handleTimelineScrubEnd}
                        onPointerDown={handleTimelineScrubStart}
                        onPointerMove={handleTimelineScrubMove}
                        onPointerUp={handleTimelineScrubEnd}
                        role="slider"
                        style={{ left: `${playhead * pxPerSecond}px` }}
                        tabIndex={0}
                    >
                        <span>{formatTime(playhead)}</span>
                    </div>
                </div>
            </div>
            <div className="odx-statusbar">
                <span>
                    SNAP <b>{isSnapEnabled ? 'ON' : 'OFF'}</b>
                </span>
                <span>
                    FPS <b>24</b>
                </span>
                <span>
                    LENGTH <b>{formatTime(durationSeconds)}</b>
                </span>
                <span className="odx-statusbar-cue-progress">
                    CUE <b>{activeCuePlaybackProgress ?? '-'}</b>
                </span>
            </div>
        </section>
    );
}

export function StudioEditor({
    apiBaseUrl,
    episode,
    episodeId,
    productId,
    initialDraft: _initialDraft,
    initialManifest: _initialManifest,
}: {
    apiBaseUrl?: string;
    episode?: StudioEditorEpisode;
    episodeId: string;
    productId: string;
    initialDraft: PlayerDraft;
    initialManifest: PlayerManifest;
}) {
    const [activePanelId, setActivePanelId] = useState<PanelId>('fx');
    const [selectedId, setSelectedId] = useState('');
    const [focusedTrackId, setFocusedTrackId] = useState('');
    const [playhead, setPlayhead] = useState(INITIAL_PLAYHEAD_SECONDS);
    const [isPlaying, setIsPlaying] = useState(false);
    const timelineAudioPlaybackRef = useRef<StudioTimelineAudioState>(new Map());
    const [pxPerSecond, setPxPerSecond] = useState(DEFAULT_PX_PER_SECOND);
    const [previewZoom, setPreviewZoom] = useState(1);
    const [previewMode, setPreviewMode] = useState<PreviewMode>('preview');
    const [timelineTool, setTimelineTool] = useState<TimelineToolMode>('select');
    const [isSnapEnabled, setIsSnapEnabled] = useState(true);
    const [rangeSelectionIds, setRangeSelectionIds] = useState<string[]>([]);
    const [mutedTrackIds, setMutedTrackIds] = useState<string[]>([]);
    const [soloTrackIds, setSoloTrackIds] = useState<string[]>([]);
    const [lockedTrackIds, setLockedTrackIds] = useState<string[]>([]);
    const [isPreviewAudioEnabled, setIsPreviewAudioEnabled] = useState(true);
    const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
    const [isPreviewLocked, setIsPreviewLocked] = useState(false);
    const [isAddingAnchor, setIsAddingAnchor] = useState(false);
    const [isAddingCutCue, setIsAddingCutCue] = useState(false);
    const [previewStripHeightPx, setPreviewStripHeightPx] = useState(PREVIEW_SCROLL_STRIP_HEIGHT_PX);
    const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE_PANEL_HEIGHT);
    const [timelineSidebarWidth, setTimelineSidebarWidth] = useState(DEFAULT_TIMELINE_SIDEBAR_WIDTH);
    const [manualTimelineDurationSeconds, setManualTimelineDurationSeconds] = useState(TIMELINE_DURATION_SECONDS);
    const [effectsById, setEffectsById] = useState<Record<string, EffectId[]>>({});
    const [characters, setCharacters] = useState<CharacterDefinition[]>([]);
    const [isCharacterCreateOpen, setIsCharacterCreateOpen] = useState(false);
    const [characterCreateDraft, setCharacterCreateDraft] =
        useState<CharacterCreateDraft>(initialCharacterCreateDraft);
    const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
    const [characterCreateError, setCharacterCreateError] = useState<string | null>(null);
    const [mediaItems, setMediaItems] = useState<MediaListItem[]>([]);
    const [mediaUploadState, setMediaUploadState] = useState<MediaUploadState>({ status: 'idle' });
    const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
    const [audioItems, setAudioItems] = useState<AudioListItem[]>([]);
    const [audioUploadState, setAudioUploadState] = useState<AudioUploadState>({ status: 'idle' });
    const [mediaContextMenu, setMediaContextMenu] = useState<MediaContextMenuState | null>(null);
    const [deletingMediaId, setDeletingMediaId] = useState<number | null>(null);
    const [trackContextMenu, setTrackContextMenu] = useState<TrackContextMenuState | null>(null);
    const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
    const [canvasItems, setCanvasItems] = useState<CanvasListItem[]>([]);
    const [activeCutCanvasId, setActiveCutCanvasId] = useState<number | null>(null);
    const [selectedPreviewCanvasId, setSelectedPreviewCanvasId] = useState<number | null>(null);
    const [editableVisualClips, setEditableVisualClips] = useState<VisualClip[]>([]);
    const [dirtyImageCompositionCanvasIds, setDirtyImageCompositionCanvasIds] = useState<number[]>([]);
    const [imageCompositionDraft, setImageCompositionDraft] = useState<ImageCompositionDraft>(
        createEmptyImageCompositionDraft,
    );
    const [isConfirmingImageComposition, setIsConfirmingImageComposition] = useState(false);
    const [imageCompositionConfirmError, setImageCompositionConfirmError] = useState<string | null>(null);
    const [tracks, setTracks] = useState<TrackListItem[]>([]);
    const [dialogueCues, setDialogueCues] = useState<DialogueCue[]>([]);
    const [isDialogueLoading, setIsDialogueLoading] = useState(false);
    const [dialogueLoadError, setDialogueLoadError] = useState<string | null>(null);
    const [timelineData, setTimelineData] = useState<TimelineData>(emptyTimelineData);
    const [scrollEvents, setScrollEvents] = useState<ScrollEventClip[]>([]);
    const [anchors, setAnchors] = useState<AnchorListItem[]>([]);
    const [anchorPlacementTrackId, setAnchorPlacementTrackId] = useState<string | null>(null);
    const [cutCuePlacementTrackId, setCutCuePlacementTrackId] = useState<string | null>(null);
    const [anchorEventDraft, setAnchorEventDraft] = useState<AnchorEventDraft>(defaultAnchorEventDraft);
    const [trackLoadError, setTrackLoadError] = useState<string | null>(null);
    const [cueScriptDraft, setCueScriptDraft] = useState('');
    const [isSavingCueScript, setIsSavingCueScript] = useState(false);
    const [cueScriptError, setCueScriptError] = useState<string | null>(null);
    const [timelinePointerEdit, setTimelinePointerEdit] = useState<TimelinePointerEdit | null>(null);
    const [timelineAnchorPointerEdit, setTimelineAnchorPointerEdit] = useState<TimelineAnchorPointerEdit | null>(null);
    const [timelinePanelResize, setTimelinePanelResize] = useState<TimelinePanelResize | null>(null);
    const [timelineSidebarResize, setTimelineSidebarResize] = useState<TimelineSidebarResize | null>(null);
    const [inspectorWidth, setInspectorWidth] = useState(DEFAULT_INSPECTOR_WIDTH);
    const [inspectorResize, setInspectorResize] = useState<InspectorResize | null>(null);
    const [previewScrollPointerEdit, setPreviewScrollPointerEdit] = useState<PreviewScrollPointerEdit | null>(null);
    const [previewAnchorPointerEdit, setPreviewAnchorPointerEdit] = useState<PreviewAnchorPointerEdit | null>(null);
    const [previewCuePointerEdit, setPreviewCuePointerEdit] = useState<PreviewCuePointerEdit | null>(null);
    const [previewVisualSegments, setPreviewVisualSegments] = useState<PreviewScrollVisualSegment[]>([]);
    const [visualCutPointerEdit, setVisualCutPointerEdit] = useState<VisualCutPointerEdit | null>(null);
    const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
    const [newTrackType, setNewTrackType] = useState<TrackFormType>('record');
    const [newTrackName, setNewTrackName] = useState('');
    const [newTrackCharacterId, setNewTrackCharacterId] = useState('');
    const [isCreatingTrack, setIsCreatingTrack] = useState(false);
    const [trackModalError, setTrackModalError] = useState<string | null>(null);
    const resolvedApiBaseUrl = apiBaseUrl || 'http://127.0.0.1:4100';
    const episodeTitle = episode?.title?.trim() || `에피소드 ${episodeId}`;
    const episodeLabel = formatEpisodeLabel(episode?.episodeNumber, episodeId);
    const episodeMeta = episode?.subTitle?.trim() ? `${episodeLabel} · ${episode.subTitle.trim()}` : episodeLabel;
    const characterById = useMemo(() => new Map(characters.map((character) => [character.id, character])), [characters]);
    const dialogueLines = useMemo(
        () =>
            dialogueCues
                .map((cue) => {
                    const character = characterById.get(String(cue.characterId));
                    const text = cue.script.trim();

                    return {
                        id: `cue-dialogue-${cue.id}`,
                        cueId: cue.id,
                        startTime: cue.startTime,
                        time: formatTime(toTimelineSeconds(cue.startTime)),
                        text: text || '대사 없음',
                        meta: `${character?.name ?? `캐릭터 ${cue.characterId}`} · ${cue.trackName}`,
                    };
                })
                .sort((a, b) => a.startTime - b.startTime || a.cueId - b.cueId),
        [characterById, dialogueCues],
    );
    const visualClipById = useMemo(() => new Map(editableVisualClips.map((clip) => [clip.id, clip])), [editableVisualClips]);
    const canvasSummaries = useMemo(
        () => toCutEditCanvasSummaries(canvasItems, editableVisualClips),
        [canvasItems, editableVisualClips],
    );
    const previewCanvasOptions = useMemo(() => getPreviewCanvasOptions(canvasItems), [canvasItems]);
    const resolvedPreviewCanvasId = useMemo(
        () => resolvePreviewCanvasId(canvasItems, selectedPreviewCanvasId),
        [canvasItems, selectedPreviewCanvasId],
    );
    const previewVisualClips = useMemo(
        () => filterPreviewCanvasItems(editableVisualClips, resolvedPreviewCanvasId),
        [editableVisualClips, resolvedPreviewCanvasId],
    );
    const resolvedActiveCutCanvasId = useMemo(() => {
        if (typeof activeCutCanvasId === 'number' && canvasSummaries.some((canvas) => canvas.id === activeCutCanvasId)) {
            return activeCutCanvasId;
        }

        const selectedCanvasId = visualClipById.get(selectedId)?.canvasId;

        if (typeof selectedCanvasId === 'number' && canvasSummaries.some((canvas) => canvas.id === selectedCanvasId)) {
            return selectedCanvasId;
        }

        return canvasSummaries[0]?.id ?? null;
    }, [activeCutCanvasId, canvasSummaries, selectedId, visualClipById]);
    const dirtyImageCompositionCanvasIdSet = useMemo(
        () => new Set(dirtyImageCompositionCanvasIds),
        [dirtyImageCompositionCanvasIds],
    );
    const imageCompositionSources = useMemo(() => toImageCompositionSources(editableVisualClips), [editableVisualClips]);
    const canConfirmImageComposition =
        typeof resolvedActiveCutCanvasId === 'number' && dirtyImageCompositionCanvasIdSet.has(resolvedActiveCutCanvasId);
    const audioTrackById = useMemo(() => new Map(timelineData.audioTracks.map((track) => [track.id, track])), [timelineData.audioTracks]);
    const cutCueTracks = useMemo(
        () => timelineData.audioTracks.filter((track) => !isScrollTrackKind(track.kind) && Boolean(track.characterId)),
        [timelineData.audioTracks],
    );
    const cutCueTargetTrackId = useMemo(() => {
        if (cutCuePlacementTrackId && cutCueTracks.some((track) => track.id === cutCuePlacementTrackId)) {
            return cutCuePlacementTrackId;
        }

        if (cutCueTracks.some((track) => track.id === focusedTrackId)) {
            return focusedTrackId;
        }

        return cutCueTracks[0]?.id ?? '';
    }, [cutCuePlacementTrackId, cutCueTracks, focusedTrackId]);
    const cutEditCueTracks = useMemo(
        () => toCutEditCueTracks(tracks, timelineData.audioTracks),
        [timelineData.audioTracks, tracks],
    );
    const audioClipById = useMemo(() => new Map(timelineData.timelineClips.map((clip) => [clip.id, clip])), [timelineData.timelineClips]);
    const activeStageCanvasId = previewMode === 'cutEdit' ? resolvedActiveCutCanvasId : resolvedPreviewCanvasId;
    const videoTimelineClips = useMemo(
        () =>
            filterPreviewCanvasItems(editableVisualClips, activeStageCanvasId).filter(
                (clip) => clip.mediaType === 'video' && typeof clip.canvasId === 'number',
            ),
        [activeStageCanvasId, editableVisualClips],
    );
    const scrollEventById = useMemo(() => new Map(scrollEvents.map((event) => [event.id, event])), [scrollEvents]);
    const anchorBySelectionId = useMemo(() => new Map(anchors.map((anchor) => [getAnchorSelectionId(anchor.id), toAnchorSelection(anchor)])), [anchors]);
    const playbackScrollEvents = useMemo(() => toPreviewPlaybackScrollEvents(scrollEvents, anchors), [anchors, scrollEvents]);
    const stageAnchors = useMemo(() => filterPreviewCanvasItems(anchors, activeStageCanvasId), [activeStageCanvasId, anchors]);
    const stageScrollEvents = useMemo(
        () => filterPreviewCanvasItems(scrollEvents, activeStageCanvasId),
        [activeStageCanvasId, scrollEvents],
    );
    const stagePlaybackScrollEvents = useMemo(
        () => filterPreviewCanvasItems(playbackScrollEvents, activeStageCanvasId),
        [activeStageCanvasId, playbackScrollEvents],
    );
    const timelineDurationSeconds = useMemo(() => {
        const maxAudioEnd = timelineData.timelineClips.reduce((maxEnd, clip) => Math.max(maxEnd, clip.start + clip.duration), 0);
        const maxVideoEnd = videoTimelineClips.reduce((maxEnd, clip) => Math.max(maxEnd, clip.start + clip.duration), 0);
        const maxScrollEnd = playbackScrollEvents.reduce((maxEnd, event) => Math.max(maxEnd, event.start + event.duration), 0);
        return Math.max(manualTimelineDurationSeconds, TIMELINE_DURATION_SECONDS, Math.ceil(maxAudioEnd), Math.ceil(maxVideoEnd), Math.ceil(maxScrollEnd));
    }, [manualTimelineDurationSeconds, playbackScrollEvents, timelineData.timelineClips, videoTimelineClips]);
    const activeVisual = useSelectedPreviewVisual(selectedId, editableVisualClips);
    const selectedPreviewVisual = useSelectedPreviewVisual(selectedId, previewVisualClips);
    const previewActiveVisual = selectedPreviewVisual ?? previewVisualClips[0];
    const selectedItem = getSelectedItem(selectedId, visualClipById, audioClipById, scrollEventById, anchorBySelectionId);
    const shouldShowCutEditInspector = Boolean(selectedItem);
    const selectedEffects = getItemEffects(selectedItem ?? activeVisual, effectsById);
    const isAnchorPlacementMode = anchorPlacementTrackId !== null;
    const isCutCuePlacementMode = cutCuePlacementTrackId !== null;
    const selectedTrackCharacter = newTrackCharacterId ? characterById.get(newTrackCharacterId) : undefined;
    const canCreateTrack = !isCreatingTrack && (newTrackType !== 'record' || Boolean(selectedTrackCharacter));
    const cueScriptState: CueScriptPanelState = {
        draft: cueScriptDraft,
        error: cueScriptError,
        isSaving: isSavingCueScript,
    };
    const characterCreateState: CharacterCreatePanelState = {
        draft: characterCreateDraft,
        error: characterCreateError,
        isOpen: isCharacterCreateOpen,
        isSaving: isCreatingCharacter,
    };

    useEffect(() => {
        let ignore = false;

        listCharacters(resolvedApiBaseUrl, productId)
            .then((items) => {
                if (!ignore) {
                    setCharacters(toCharacterDefinitions(items));
                }
            })
            .catch(() => {
                if (!ignore) {
                    setCharacters([]);
                }
            });

        return () => {
            ignore = true;
        };
    }, [productId, resolvedApiBaseUrl]);

    useEffect(() => {
        const selectedAudioClip = timelineData.timelineClips.find((clip) => clip.id === selectedId);

        setCueScriptDraft(selectedAudioClip?.label ?? '');
        setCueScriptError(null);
    }, [selectedId]);

    useEffect(() => {
        if (!selectedItem || !isAnchorSelection(selectedItem)) {
            setAnchorEventDraft(defaultAnchorEventDraft);
            return;
        }

        const selectedAnchor = anchors.find((anchor) => anchor.id === selectedItem.anchorId);
        const event = selectedAnchor?.event ?? selectedItem.event;

        if (event?.type === 'scroll') {
            setAnchorEventDraft({
                type: 'scroll',
                endAnchorId: String(event.endAnchorId),
                duration: '1000',
                isSaving: false,
                error: null,
            });
            return;
        }

        if (event?.type === 'pause') {
            setAnchorEventDraft({
                type: 'pause',
                endAnchorId: '',
                duration: String(event.duration),
                isSaving: false,
                error: null,
            });
            return;
        }

        const fallbackEndAnchor = anchors.find(
            (anchor) =>
                String(anchor.trackId) === selectedItem.trackId &&
                anchor.id !== selectedItem.anchorId &&
                anchor.canvasId === selectedItem.canvasId &&
                anchor.time > selectedItem.time,
        );

        setAnchorEventDraft({
            ...defaultAnchorEventDraft,
            endAnchorId: fallbackEndAnchor ? String(fallbackEndAnchor.id) : '',
        });
    }, [anchors, selectedItem]);

    useEffect(() => {
        let ignore = false;

        listMedias(resolvedApiBaseUrl, episodeId)
            .then((items) => {
                if (!ignore) {
                    setMediaItems(items);
                }
            })
            .catch(() => {
                if (!ignore) {
                    setMediaItems([]);
                }
            });

        return () => {
            ignore = true;
        };
    }, [episodeId, resolvedApiBaseUrl]);

    useEffect(() => {
        const availableMediaIds = new Set(mediaItems.map((item) => item.id));

        setSelectedMediaIds((current) => {
            const nextSelectionIds = current.filter((id) => availableMediaIds.has(id));

            return nextSelectionIds.length === current.length ? current : nextSelectionIds;
        });
    }, [mediaItems]);

    useEffect(() => {
        let ignore = false;

        listAudios(resolvedApiBaseUrl, episodeId)
            .then((items) => {
                if (!ignore) {
                    setAudioItems(items);
                }
            })
            .catch(() => {
                if (!ignore) {
                    setAudioItems([]);
                }
            });

        return () => {
            ignore = true;
        };
    }, [episodeId, resolvedApiBaseUrl]);

    useEffect(() => {
        let ignore = false;

        listCanvases(resolvedApiBaseUrl, episodeId)
            .then((items) => {
                if (!ignore) {
                    const nextVisualClips = toVisualClips(items);

                    setCanvasItems(items);
                    setEditableVisualClips(nextVisualClips);
                    setDirtyImageCompositionCanvasIds([]);
                    setActiveCutCanvasId((current) => {
                        const nextCanvasIds = new Set(items.map((item) => item.id));

                        if (typeof current === 'number' && nextCanvasIds.has(current)) {
                            return current;
                        }

                        return nextVisualClips.find((clip) => typeof clip.canvasId === 'number')?.canvasId ?? items[0]?.id ?? null;
                    });
                    setSelectedId((current) => {
                        if (!current || (isVisualClipId(current) && !nextVisualClips.some((clip) => clip.id === current))) {
                            return nextVisualClips[0]?.id ?? '';
                        }

                        return current;
                    });
                }
            })
            .catch(() => {
                if (!ignore) {
                    setCanvasItems([]);
                    setActiveCutCanvasId(null);
                    setEditableVisualClips([]);
                    setDirtyImageCompositionCanvasIds([]);
                    setSelectedId((current) => (isVisualClipId(current) ? '' : current));
                }
            });

        return () => {
            ignore = true;
        };
    }, [episodeId, resolvedApiBaseUrl]);

    useEffect(() => {
        setSelectedPreviewCanvasId((current) => resolvePreviewCanvasId(canvasItems, current));
    }, [canvasItems]);

    useEffect(() => {
        setImageCompositionDraft((current) => syncImageCompositionDraft(imageCompositionSources, current));
    }, [imageCompositionSources]);

    useEffect(() => {
        if (previewMode !== 'cutEdit') {
            setAnchorPlacementTrackId(null);
            setCutCuePlacementTrackId(null);
        }
    }, [previewMode]);

    useEffect(() => {
        if (cutCuePlacementTrackId && !cutCueTracks.some((track) => track.id === cutCuePlacementTrackId)) {
            setCutCuePlacementTrackId(null);
        }
    }, [cutCuePlacementTrackId, cutCueTracks]);

    useEffect(() => {
        let ignore = false;

        listTracks(resolvedApiBaseUrl, episodeId)
            .then(async (tracks) => {
                const nextTimelineData = toTimelineData(tracks);
                const nextAnchors = await listAnchorsForTracks(
                    resolvedApiBaseUrl,
                    nextTimelineData.audioTracks.filter((track) => isScrollTrackKind(track.kind)).map((track) => track.id),
                );

                if (!ignore) {
                    setTracks(tracks);
                    setTimelineData({
                        audioTracks: nextTimelineData.audioTracks,
                        timelineClips: nextTimelineData.timelineClips,
                    });
                    setScrollEvents(nextTimelineData.scrollEvents);
                    setAnchors(nextAnchors);
                    setFocusedTrackId((current) => {
                        if (nextTimelineData.audioTracks.some((track) => track.id === current)) {
                            return current;
                        }

                        return (
                            nextTimelineData.audioTracks.find((track) => !isScrollTrackKind(track.kind) && track.characterId)?.id ??
                            nextTimelineData.audioTracks.find((track) => !isScrollTrackKind(track.kind))?.id ??
                            ''
                        );
                    });
                    setTrackLoadError(null);
                }
            })
            .catch((error) => {
                if (!ignore) {
                    setTracks([]);
                    setTimelineData(emptyTimelineData);
                    setScrollEvents([]);
                    setAnchors([]);
                    setAnchorPlacementTrackId(null);
                    setCutCuePlacementTrackId(null);
                    setFocusedTrackId('');
                    setTrackLoadError(
                        error instanceof Error
                            ? `트랙 목록을 불러오지 못했습니다: ${error.message}`
                            : '트랙 목록을 불러오지 못했습니다.'
                    );
                }
            });

        return () => {
            ignore = true;
        };
    }, [episodeId, resolvedApiBaseUrl]);

    useEffect(() => {
        let ignore = false;
        const cueTracks = tracks.filter((track) => !isScrollTrackKind(track.type));

        if (cueTracks.length === 0) {
            setDialogueCues([]);
            setDialogueLoadError(null);
            setIsDialogueLoading(false);

            return () => {
                ignore = true;
            };
        }

        setIsDialogueLoading(true);
        setDialogueLoadError(null);

        Promise.all(
            cueTracks.map(async (track) => {
                const cues = await listTrackCues(resolvedApiBaseUrl, String(track.id));

                return cues
                    .filter((cue) => typeof cue.characterId === 'number')
                    .map((cue) => ({
                        ...cue,
                        trackName: track.name,
                    }));
            }),
        )
            .then((cueGroups) => {
                if (!ignore) {
                    setDialogueCues(
                        cueGroups
                            .flat()
                            .sort((a, b) => a.startTime - b.startTime || a.id - b.id),
                    );
                    setDialogueLoadError(null);
                }
            })
            .catch((error) => {
                if (!ignore) {
                    setDialogueCues([]);
                    setDialogueLoadError(
                        error instanceof Error
                            ? `대사 목록을 불러오지 못했습니다: ${error.message}`
                            : '대사 목록을 불러오지 못했습니다.',
                    );
                }
            })
            .finally(() => {
                if (!ignore) {
                    setIsDialogueLoading(false);
                }
            });

        return () => {
            ignore = true;
        };
    }, [resolvedApiBaseUrl, tracks]);

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
        syncStudioTimelineAudioPlayback({
            audioByClipId: timelineAudioPlaybackRef.current,
            clips: timelineData.timelineClips,
            createAudio: (url) => {
                const audio = new Audio(url);
                audio.preload = 'auto';
                return audio;
            },
            isPlaying: isPlaying && isPreviewAudioEnabled,
            mutedTrackIds,
            playhead,
            soloTrackIds,
        });
    }, [isPlaying, isPreviewAudioEnabled, mutedTrackIds, playhead, soloTrackIds, timelineData.timelineClips]);

    useEffect(
        () => () => {
            stopStudioTimelineAudioPlayback(timelineAudioPlaybackRef.current);
        },
        [],
    );

    useEffect(() => {
        if (!timelinePanelResize) {
            return undefined;
        }

        const handlePointerMove = (event: PointerEvent) => {
            event.preventDefault();
            setTimelineHeight(
                clamp(
                    timelinePanelResize.originalHeight - (event.clientY - timelinePanelResize.pointerStartY),
                    MIN_TIMELINE_PANEL_HEIGHT,
                    MAX_TIMELINE_PANEL_HEIGHT,
                ),
            );
        };

        const handlePointerEnd = (event: PointerEvent) => {
            event.preventDefault();
            setTimelinePanelResize(null);
        };

        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerEnd, { passive: false });
        window.addEventListener('pointercancel', handlePointerEnd, { passive: false });

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerEnd);
            window.removeEventListener('pointercancel', handlePointerEnd);
        };
    }, [timelinePanelResize]);

    useEffect(() => {
        if (!timelineSidebarResize) {
            return undefined;
        }

        const handlePointerMove = (event: PointerEvent) => {
            event.preventDefault();
            setTimelineSidebarWidth(
                getTimelineSidebarResizeWidth({
                    originalWidth: timelineSidebarResize.originalWidth,
                    pointerStartX: timelineSidebarResize.pointerStartX,
                    pointerCurrentX: event.clientX,
                    minWidth: MIN_TIMELINE_SIDEBAR_WIDTH,
                    maxWidth: MAX_TIMELINE_SIDEBAR_WIDTH,
                }),
            );
        };

        const handlePointerEnd = (event: PointerEvent) => {
            event.preventDefault();
            setTimelineSidebarResize(null);
        };

        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerEnd, { passive: false });
        window.addEventListener('pointercancel', handlePointerEnd, { passive: false });

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerEnd);
            window.removeEventListener('pointercancel', handlePointerEnd);
        };
    }, [timelineSidebarResize]);

    useEffect(() => {
        if (!inspectorResize) {
            return undefined;
        }

        const handlePointerMove = (event: PointerEvent) => {
            event.preventDefault();
            setInspectorWidth(
                clamp(
                    inspectorResize.originalWidth - (event.clientX - inspectorResize.pointerStartX),
                    MIN_INSPECTOR_WIDTH,
                    MAX_INSPECTOR_WIDTH,
                ),
            );
        };

        const handlePointerEnd = (event: PointerEvent) => {
            event.preventDefault();
            setInspectorResize(null);
        };

        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerEnd, { passive: false });
        window.addEventListener('pointercancel', handlePointerEnd, { passive: false });

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerEnd);
            window.removeEventListener('pointercancel', handlePointerEnd);
        };
    }, [inspectorResize]);

    const refreshTimelineTracks = async () => {
        const nextTracks = await listTracks(resolvedApiBaseUrl, episodeId);
        const nextTimelineData = toTimelineData(nextTracks);
        const nextAnchors = await listAnchorsForTracks(
            resolvedApiBaseUrl,
            nextTimelineData.audioTracks.filter((track) => isScrollTrackKind(track.kind)).map((track) => track.id),
        );

        setTracks(nextTracks);
        setTimelineData({
            audioTracks: nextTimelineData.audioTracks,
            timelineClips: nextTimelineData.timelineClips,
        });
        setScrollEvents(nextTimelineData.scrollEvents);
        setAnchors(nextAnchors);

        return nextTimelineData;
    };

    const findMatchingScrollEvent = (events: ScrollEventClip[], trackId: string, request: ScrollEventMutationRequest) =>
        [...events].reverse().find((event) => {
            const eventRequest = toScrollEventMutationRequest(event);

            return (
                eventRequest &&
                event.track === trackId &&
                eventRequest.startAnchorId === request.startAnchorId &&
                eventRequest.endAnchorId === request.endAnchorId
            );
        });

    const createScrollEventMutationRequest = async (event: ScrollEventClip) => {
        const anchorRequests = toScrollAnchorMutationRequests(event);

        if (!anchorRequests) {
            throw new Error('스크롤 앵커 기준 이미지를 확인할 수 없습니다.');
        }

        const [startAnchor, endAnchor] = await Promise.all([
            createAnchor(resolvedApiBaseUrl, event.track, anchorRequests.start),
            createAnchor(resolvedApiBaseUrl, event.track, anchorRequests.end),
        ]);

        return {
            startAnchorId: startAnchor.id,
            endAnchorId: endAnchor.id,
        };
    };

    const persistScrollEventUpdate = async (event: ScrollEventClip) => {
        const scrollId = getScrollEventApiId(event);

        if (scrollId === undefined) {
            return;
        }

        try {
            const request = await createScrollEventMutationRequest(event);

            await updateScrollEvent(resolvedApiBaseUrl, event.track, scrollId, request);
            await refreshTimelineTracks();
            setTrackLoadError(null);
        } catch (error) {
            setTrackLoadError(error instanceof Error ? `스크롤 이벤트 저장에 실패했습니다: ${error.message}` : '스크롤 이벤트 저장에 실패했습니다.');
        }
    };

    const persistAnchorUpdate = async (anchor: AnchorListItem, request: ScrollAnchorMutationRequest) => {
        const nextAnchor = applyAnchorMutation(anchor, request);

        try {
            await updateAnchor(resolvedApiBaseUrl, String(anchor.trackId), anchor.id, request);
            await refreshTimelineTracks();
            setTrackLoadError(null);
        } catch (error) {
            setAnchors((current) => replaceAnchor(current, anchor));
            setTrackLoadError(error instanceof Error ? `앵커 저장에 실패했습니다: ${error.message}` : '앵커 저장에 실패했습니다.');
            setSelectedId(getAnchorSelectionId(anchor.id));
        }

        return nextAnchor;
    };

    const persistCuePositionUpdate = async (edit: PreviewCuePointerEdit, request: CueStripPositionRequest) => {
        const cueTrackId = resolveCueTimelineTrackId({
            parentTrackId: edit.trackId,
            cueTrackId: edit.cue.trackId,
        });

        try {
            await updateCue(resolvedApiBaseUrl, cueTrackId, String(edit.cue.id), request);
            await refreshTimelineTracks();
            setSelectedId(`cue-${edit.cue.id}`);
            setFocusedTrackId(cueTrackId);
            setTrackLoadError(null);
        } catch (error) {
            await refreshTimelineTracks().catch(() => undefined);
            setTrackLoadError(error instanceof Error ? `큐 위치 저장에 실패했습니다: ${error.message}` : '큐 위치 저장에 실패했습니다.');
            setSelectedId(`cue-${edit.cue.id}`);
            setFocusedTrackId(cueTrackId);
        }
    };

    const persistCueTimingUpdate = async (clip: TimelineClip) => {
        const target = toCueMutationTarget(clip);

        if (!target) {
            return;
        }

        try {
            await updateCue(resolvedApiBaseUrl, target.trackId, target.cueId, toCueTimingUpdateRequest(clip));
            await refreshTimelineTracks();
            setTrackLoadError(null);
        } catch (error) {
            await refreshTimelineTracks().catch(() => undefined);
            setTrackLoadError(error instanceof Error ? `큐 위치 저장에 실패했습니다: ${error.message}` : '큐 위치 저장에 실패했습니다.');
        }
    };

    const persistVideoTimelineUpdate = async (clip: VisualClip, nextVisualClips: VisualClip[]) => {
        if (typeof clip.canvasId !== 'number') {
            return;
        }

        try {
            await updateCanvas(resolvedApiBaseUrl, episodeId, clip.canvasId, {
                medias: toCanvasUpdateMediasFromVisualClips(nextVisualClips, clip.canvasId),
            });

            const nextCanvasItems = await listCanvases(resolvedApiBaseUrl, episodeId);
            const refreshedVisualClips = toVisualClips(nextCanvasItems);

            setCanvasItems(nextCanvasItems);
            setEditableVisualClips(refreshedVisualClips);
            setImageCompositionDraft((current) => syncImageCompositionDraft(toImageCompositionSources(refreshedVisualClips), current));
            setTrackLoadError(null);
        } catch (error) {
            const nextCanvasItems = await listCanvases(resolvedApiBaseUrl, episodeId).catch(() => []);
            const refreshedVisualClips = toVisualClips(nextCanvasItems);

            if (nextCanvasItems.length > 0) {
                setCanvasItems(nextCanvasItems);
                setEditableVisualClips(refreshedVisualClips);
            }
            setTrackLoadError(error instanceof Error ? `비디오 타임라인 저장에 실패했습니다: ${error.message}` : '비디오 타임라인 저장에 실패했습니다.');
        }
    };

    const handleSelectItem = (itemId: string) => {
        const scrollEvent = scrollEventById.get(itemId);
        const timelineItem = audioClipById.get(itemId) ?? scrollEvent;
        const visualItem = visualClipById.get(itemId);

        setSelectedId(itemId);
        setRangeSelectionIds([]);

        if (timelineItem) {
            setFocusedTrackId(timelineItem.track);
        }
        if (visualItem?.mediaType === 'video') {
            setFocusedTrackId(VIDEO_TIMELINE_TRACK_ID);
            setPlayhead(visualItem.start);
        }
        if (scrollEvent) {
            setPlayhead(scrollEvent.start);
        }
    };

    const handleSelectAnchor = (anchorId: number) => {
        const anchor = anchors.find((item) => item.id === anchorId);

        if (!anchor) {
            return;
        }

        setSelectedId(getAnchorSelectionId(anchor.id));
        setRangeSelectionIds([]);
        setFocusedTrackId(String(anchor.trackId));
        setPlayhead(toTimelineSeconds(anchor.time));
    };

    const handleAnchorEventDraftChange = (patch: Partial<Pick<AnchorEventDraft, 'type' | 'endAnchorId' | 'duration'>>) => {
        setAnchorEventDraft((current) => {
            const nextType = patch.type ?? current.type;
            const nextEndAnchorId =
                patch.endAnchorId ??
                (patch.type === 'scroll' && !current.endAnchorId && selectedItem && isAnchorSelection(selectedItem)
                    ? String(
                          anchors.find(
                              (anchor) =>
                                  String(anchor.trackId) === selectedItem.trackId &&
                                  anchor.id !== selectedItem.anchorId &&
                                  anchor.canvasId === selectedItem.canvasId &&
                                  anchor.time > selectedItem.time,
                          )?.id ?? '',
                      )
                    : current.endAnchorId);

            return {
                ...current,
                ...patch,
                type: nextType,
                endAnchorId: nextEndAnchorId,
                error: null,
            };
        });
    };

    const handleSaveAnchorEvent = async () => {
        if (!selectedItem || !isAnchorSelection(selectedItem)) {
            return;
        }

        let request: AnchorEventMutationRequest;

        if (anchorEventDraft.type === 'scroll') {
            const endAnchorId = Number(anchorEventDraft.endAnchorId);

            if (!Number.isInteger(endAnchorId) || endAnchorId <= 0) {
                setAnchorEventDraft((current) => ({ ...current, error: '종료 앵커를 선택해 주세요.' }));
                return;
            }
            if (endAnchorId === selectedItem.anchorId) {
                setAnchorEventDraft((current) => ({ ...current, error: '스크롤 종료 앵커는 현재 앵커와 달라야 합니다.' }));
                return;
            }

            request = { type: 'scroll', endAnchorId };
        } else {
            const duration = Number(anchorEventDraft.duration);

            if (!Number.isFinite(duration) || duration <= 0) {
                setAnchorEventDraft((current) => ({ ...current, error: '정지 시간은 0보다 큰 ms 값이어야 합니다.' }));
                return;
            }

            request = { type: 'pause', duration };
        }

        try {
            setAnchorEventDraft((current) => ({ ...current, isSaving: true, error: null }));
            await upsertAnchorEvent(resolvedApiBaseUrl, selectedItem.trackId, selectedItem.anchorId, request);
            await refreshTimelineTracks();
            setSelectedId(getAnchorSelectionId(selectedItem.anchorId));
            setFocusedTrackId(selectedItem.trackId);
            setTrackLoadError(null);
        } catch (error) {
            setAnchorEventDraft((current) => ({
                ...current,
                isSaving: false,
                error: error instanceof Error ? `앵커 이벤트 저장에 실패했습니다: ${error.message}` : '앵커 이벤트 저장에 실패했습니다.',
            }));
        }
    };

    const handleDeleteAnchorEvent = async () => {
        if (!selectedItem || !isAnchorSelection(selectedItem)) {
            return;
        }

        try {
            setAnchorEventDraft((current) => ({ ...current, isSaving: true, error: null }));
            await deleteAnchorEvent(resolvedApiBaseUrl, selectedItem.trackId, selectedItem.anchorId);
            await refreshTimelineTracks();
            setSelectedId(getAnchorSelectionId(selectedItem.anchorId));
            setFocusedTrackId(selectedItem.trackId);
            setTrackLoadError(null);
        } catch (error) {
            setAnchorEventDraft((current) => ({
                ...current,
                isSaving: false,
                error: error instanceof Error ? `앵커 이벤트 삭제에 실패했습니다: ${error.message}` : '앵커 이벤트 삭제에 실패했습니다.',
            }));
        }
    };

    const handleDeleteAnchor = async () => {
        if (!selectedItem || !isAnchorSelection(selectedItem)) {
            return;
        }

        const anchorSelectionId = getAnchorSelectionId(selectedItem.anchorId);

        try {
            setAnchorEventDraft((current) => ({ ...current, isSaving: true, error: null }));
            await deleteAnchor(resolvedApiBaseUrl, selectedItem.trackId, selectedItem.anchorId);
            await refreshTimelineTracks();
            setSelectedId((current) => (current === anchorSelectionId ? activeVisual?.id ?? '' : current));
            setRangeSelectionIds((current) => current.filter((id) => id !== anchorSelectionId));
            setAnchorEventDraft(defaultAnchorEventDraft);
            setTrackLoadError(null);
        } catch (error) {
            setAnchorEventDraft((current) => ({
                ...current,
                isSaving: false,
                error: error instanceof Error ? `앵커 삭제에 실패했습니다: ${error.message}` : '앵커 삭제에 실패했습니다.',
            }));
        }
    };

    const handleFocusTrack = (trackId: string) => {
        setFocusedTrackId(trackId);
        if (cutCuePlacementTrackId && cutCueTracks.some((track) => track.id === trackId)) {
            setCutCuePlacementTrackId(trackId);
        }
        setRangeSelectionIds([]);
    };

    const handleOpenTrackContextMenu = (event: ReactMouseEvent<HTMLElement>, track: AudioTrackDefinition) => {
        const menuWidth = 172;
        const menuHeight = 44;

        event.preventDefault();
        event.stopPropagation();
        setMediaContextMenu(null);
        setFocusedTrackId(track.id);
        setRangeSelectionIds([]);
        setTrackContextMenu({
            trackId: track.id,
            trackLabel: track.label,
            x: clamp(event.clientX, 8, Math.max(8, window.innerWidth - menuWidth)),
            y: clamp(event.clientY, 8, Math.max(8, window.innerHeight - menuHeight)),
        });
    };

    const handleCloseTrackContextMenu = () => {
        setTrackContextMenu(null);
    };

    const handleDeleteTrack = async (trackId: string) => {
        const deletedAnchorIds = anchors.filter((anchor) => String(anchor.trackId) === trackId).map((anchor) => getAnchorSelectionId(anchor.id));
        const deletedItemIds = [...timelineData.timelineClips, ...scrollEvents]
            .filter((item) => item.track === trackId)
            .map((item) => item.id);
        const deletedSelectionIds = [...deletedItemIds, ...deletedAnchorIds];

        try {
            setDeletingTrackId(trackId);
            await deleteTrack(resolvedApiBaseUrl, episodeId, trackId);

            const nextTimelineData = await refreshTimelineTracks();

            setTrackContextMenu(null);
            setMutedTrackIds((current) => current.filter((id) => id !== trackId));
            setSoloTrackIds((current) => current.filter((id) => id !== trackId));
            setLockedTrackIds((current) => current.filter((id) => id !== trackId));
            setRangeSelectionIds((current) => current.filter((id) => !deletedSelectionIds.includes(id)));
            setEffectsById((current) => {
                const next = { ...current };

                deletedSelectionIds.forEach((id) => {
                    delete next[id];
                });

                return next;
            });
            setSelectedId((current) => (deletedSelectionIds.includes(current) ? activeVisual?.id ?? '' : current));
            setFocusedTrackId((current) => (current === trackId ? nextTimelineData.audioTracks[0]?.id ?? '' : current));
            setTrackLoadError(null);
        } catch (error) {
            setTrackLoadError(error instanceof Error ? `트랙 삭제에 실패했습니다: ${error.message}` : '트랙 삭제에 실패했습니다.');
        } finally {
            setDeletingTrackId(null);
        }
    };

    const handleTimelineToolChange = (tool: TimelineToolMode) => {
        setTimelineTool(tool);

        if (tool === 'select' || tool === 'split') {
            setRangeSelectionIds([]);
        }
    };

    const handleToggleTrackMute = (trackId: string) => {
        setMutedTrackIds((current) => toggleIdInList(current, trackId));
    };

    const handleToggleTrackSolo = (trackId: string) => {
        setSoloTrackIds((current) => toggleIdInList(current, trackId));
    };

    const handleToggleTrackLock = (trackId: string) => {
        setLockedTrackIds((current) => toggleIdInList(current, trackId));
    };

    const handleSelectTimelineRange = (itemId: string, direction: 'left' | 'right') => {
        const targetItem = audioClipById.get(itemId) ?? scrollEventById.get(itemId);

        if (!targetItem) {
            return;
        }

        const timelineItems = [...timelineData.timelineClips, ...scrollEvents];
        const nextRangeSelectionIds = timelineItems
            .filter((item) => (direction === 'left' ? item.start <= targetItem.start : item.start >= targetItem.start))
            .map((item) => item.id);

        setSelectedId(itemId);
        setRangeSelectionIds(nextRangeSelectionIds);
        setFocusedTrackId(targetItem.track);
    };

    const handleSplitTimelineItem = async (itemKind: TimelineItemKind, itemId: string) => {
        setRangeSelectionIds([]);

        if (itemKind === 'scroll') {
            const targetScrollEvent = scrollEventById.get(itemId);

            if (!targetScrollEvent) {
                return;
            }

            const splitAt = getTimelineEditSeconds(playhead, isSnapEnabled);
            const targetEnd = targetScrollEvent.start + targetScrollEvent.duration;

            if (splitAt <= targetScrollEvent.start + MIN_TIMELINE_ITEM_DURATION_SECONDS || splitAt >= targetEnd - MIN_TIMELINE_ITEM_DURATION_SECONDS) {
                setSelectedId(itemId);
                return;
            }

            const splitRatio = (splitAt - targetScrollEvent.start) / targetScrollEvent.duration;
            const startPixel = getScrollEventStartPixel(targetScrollEvent, previewStripHeightPx, previewVisualSegments);
            const endPixel = getScrollEventEndPixel(targetScrollEvent, previewStripHeightPx, previewVisualSegments);
            const splitAnchor = getPreviewScrollAnchor({
                stripPositionPx: startPixel + (endPixel - startPixel) * splitRatio,
                stripHeightPx: previewStripHeightPx,
                visualSegments: previewVisualSegments,
            });
            const leftAnchoredScrollEvent = applyScrollAnchorToEvent(
                {
                    ...targetScrollEvent,
                    duration: splitAt - targetScrollEvent.start,
                },
                'end',
                splitAnchor,
            );
            const leftScrollEvent = {
                ...leftAnchoredScrollEvent,
                sublabel: formatScrollRangeLabel(
                    leftAnchoredScrollEvent.startIndex,
                    leftAnchoredScrollEvent.startPosition,
                    leftAnchoredScrollEvent.endIndex,
                    leftAnchoredScrollEvent.endPosition,
                ),
            };
            const { scrollId: _rightScrollId, ...rightScrollEventBase } = targetScrollEvent;
            const rightAnchoredScrollEvent = applyScrollAnchorToEvent(
                {
                    ...rightScrollEventBase,
                    id: `${targetScrollEvent.id}-split-${Date.now().toString(36)}`,
                    start: splitAt,
                    duration: targetEnd - splitAt,
                    label: `${targetScrollEvent.label} B`,
                },
                'start',
                splitAnchor,
            );
            const rightScrollEvent = {
                ...rightAnchoredScrollEvent,
                sublabel: formatScrollRangeLabel(
                    rightAnchoredScrollEvent.startIndex,
                    rightAnchoredScrollEvent.startPosition,
                    rightAnchoredScrollEvent.endIndex,
                    rightAnchoredScrollEvent.endPosition,
                ),
            };
            const targetScrollId = getScrollEventApiId(targetScrollEvent);

            if (targetScrollId !== undefined) {
                try {
                    const leftRequest = await createScrollEventMutationRequest(leftScrollEvent);
                    const rightRequest = await createScrollEventMutationRequest(rightScrollEvent);

                    await updateScrollEvent(resolvedApiBaseUrl, targetScrollEvent.track, targetScrollId, leftRequest);
                    await createScrollEvent(resolvedApiBaseUrl, targetScrollEvent.track, rightRequest);

                    const nextTimelineData = await refreshTimelineTracks();
                    const createdRightScrollEvent = findMatchingScrollEvent(nextTimelineData.scrollEvents, targetScrollEvent.track, rightRequest);

                    setSelectedId(createdRightScrollEvent?.id ?? itemId);
                    setPlayhead(splitAt);
                    setTrackLoadError(null);
                } catch (error) {
                    await refreshTimelineTracks().catch(() => undefined);
                    setSelectedId(itemId);
                    setTrackLoadError(error instanceof Error ? `스크롤 이벤트 분할에 실패했습니다: ${error.message}` : '스크롤 이벤트 분할에 실패했습니다.');
                }

                return;
            }

            setScrollEvents((current) =>
                current.flatMap((scrollEvent) => {
                    if (scrollEvent.id !== itemId) {
                        return [scrollEvent];
                    }

                    return [leftScrollEvent, rightScrollEvent];
                }),
            );
            setSelectedId(rightScrollEvent.id);
            setPlayhead(splitAt);
            return;
        }

        const targetClip = audioClipById.get(itemId);

        if (!targetClip) {
            return;
        }

        const splitAt = getTimelineEditSeconds(playhead, isSnapEnabled);
        const targetEnd = targetClip.start + targetClip.duration;

        if (splitAt <= targetClip.start + MIN_TIMELINE_ITEM_DURATION_SECONDS || splitAt >= targetEnd - MIN_TIMELINE_ITEM_DURATION_SECONDS) {
            setSelectedId(itemId);
            return;
        }

        const targetCueId = getCueApiIdFromTimelineClipId(targetClip.id);
        const splitTime = Math.round(splitAt * 1000);

        if (targetCueId) {
            try {
                const nextTimelineData = await (async () => {
                    await splitCue(resolvedApiBaseUrl, targetClip.track, targetCueId, { splitTime });
                    return refreshTimelineTracks();
                })();
                const rightClip = nextTimelineData.timelineClips.find(
                    (clip) =>
                        clip.track === targetClip.track &&
                        clip.audioId === targetClip.audioId &&
                        Math.round(clip.start * 1000) === splitTime,
                );

                setSelectedId(rightClip?.id ?? itemId);
                setFocusedTrackId(targetClip.track);
                setPlayhead(splitAt);
                setTrackLoadError(null);
            } catch (error) {
                await refreshTimelineTracks().catch(() => undefined);
                setSelectedId(itemId);
                setTrackLoadError(error instanceof Error ? `큐 분할에 실패했습니다: ${error.message}` : '큐 분할에 실패했습니다.');
            }

            return;
        }

        const rightClipId = `${targetClip.id}-split-${Date.now().toString(36)}`;
        const audioSplitTime =
            typeof targetClip.audioStart === 'number'
                ? targetClip.audioStart + (splitAt - targetClip.start)
                : undefined;

        setTimelineData((current) => ({
            ...current,
            timelineClips: current.timelineClips.flatMap((clip) => {
                if (clip.id !== itemId) {
                    return [clip];
                }

                return [
                    {
                        ...clip,
                        duration: splitAt - clip.start,
                        audioEnd: audioSplitTime ?? clip.audioEnd,
                    },
                    {
                        ...clip,
                        id: rightClipId,
                        start: splitAt,
                        duration: targetEnd - splitAt,
                        audioStart: audioSplitTime ?? clip.audioStart,
                        label: `${clip.label} B`,
                        effects: [],
                    },
                ];
            }),
        }));
        setSelectedId(rightClipId);
        setPlayhead(splitAt);
    };

    const handleSelectVisual = (clipId: string) => {
        const clip = visualClipById.get(clipId);

        setMediaContextMenu(null);
        if (typeof clip?.canvasId === 'number') {
            setActiveCutCanvasId(clip.canvasId);
        }
        setSelectedId(clipId);
        setRangeSelectionIds([]);
    };

    const handleSelectCutCanvas = (canvasId: number) => {
        const firstClip = editableVisualClips.find((clip) => clip.canvasId === canvasId);

        setActiveCutCanvasId(canvasId);
        setMediaContextMenu(null);
        setSelectedId(firstClip?.id ?? '');
        setRangeSelectionIds([]);
        setImageCompositionConfirmError(null);
    };

    const markImageCompositionCanvasDirty = (canvasId: number) => {
        setDirtyImageCompositionCanvasIds((current) => (current.includes(canvasId) ? current : [...current, canvasId]));
    };

    const handleSelectMedia = (event: ReactMouseEvent<HTMLElement>, mediaId: number) => {
        setMediaContextMenu(null);
        setSelectedMediaIds((current) =>
            getNextMediaSelection({
                currentSelectionIds: current,
                clickedId: mediaId,
                orderedMediaIds: mediaItems.map((item) => item.id),
                isToggle: event.metaKey || event.ctrlKey,
                isRange: event.shiftKey,
            }),
        );
    };

    const handleDropMediaOnCutEditor = (event: ReactDragEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (isPreviewLocked) {
            return;
        }

        if (typeof resolvedActiveCutCanvasId !== 'number') {
            setImageCompositionConfirmError('수정할 캔버스를 먼저 선택해 주세요.');
            return;
        }

        const droppedMediaIds = parseMediaDragPayload(
            event.dataTransfer.getData(MEDIA_BATCH_DRAG_MIME),
            event.dataTransfer.getData(MEDIA_DRAG_MIME),
        );

        if (droppedMediaIds.length === 0) {
            return;
        }

        const mediaById = new Map(mediaItems.map((item) => [item.id, item]));
        const droppedClipIds: string[] = [];
        let nextVisualClips = editableVisualClips;

        droppedMediaIds.forEach((mediaId) => {
            const media = mediaById.get(mediaId);

            if (!media) {
                return;
            }

            const droppedClip = toDroppedMediaVisualClip(media, nextVisualClips, resolvedActiveCutCanvasId);

            if (!droppedClip) {
                return;
            }

            droppedClipIds.push(droppedClip.id);
            nextVisualClips = [...nextVisualClips, droppedClip];
        });

        if (droppedClipIds.length === 0) {
            return;
        }

        const nextReflowedVisualClips = reflowVisualClipsForCanvas(nextVisualClips, resolvedActiveCutCanvasId);
        const lastDroppedClipId = droppedClipIds[droppedClipIds.length - 1];
        const nextDroppedClip = nextReflowedVisualClips.find((clip) => clip.id === lastDroppedClipId);

        markImageCompositionCanvasDirty(resolvedActiveCutCanvasId);
        setEditableVisualClips(nextReflowedVisualClips);
        setSelectedId(nextDroppedClip?.id ?? lastDroppedClipId);
        setRangeSelectionIds([]);
        setMediaContextMenu(null);
        setImageCompositionConfirmError(null);
    };

    const handleOpenMediaContextMenu = (event: ReactMouseEvent<HTMLElement>, media: MediaListItem) => {
        const menuWidth = 172;
        const menuHeight = 44;

        event.preventDefault();
        event.stopPropagation();
        setRangeSelectionIds([]);
        setTrackContextMenu(null);
        setSelectedMediaIds((current) => (current.includes(media.id) ? current : [media.id]));
        setMediaContextMenu({
            clipId: `media-${media.id}`,
            mediaId: media.id,
            x: clamp(event.clientX, 8, Math.max(8, window.innerWidth - menuWidth)),
            y: clamp(event.clientY, 8, Math.max(8, window.innerHeight - menuHeight)),
        });
    };

    const handleCloseMediaContextMenu = () => {
        setMediaContextMenu(null);
    };

    const handleDeleteMedia = async (mediaId: number) => {
        const deletedClipId = editableVisualClips.find((clip) => clip.mediaId === mediaId)?.id ?? mediaContextMenu?.clipId ?? '';

        try {
            setDeletingMediaId(mediaId);
            setMediaUploadState({ status: 'idle' });
            setSelectedMediaIds((current) => current.filter((id) => id !== mediaId));
            await deleteMedia(resolvedApiBaseUrl, episodeId, mediaId);

            const [nextMediaItems, nextCanvasItems] = await Promise.all([
                listMedias(resolvedApiBaseUrl, episodeId),
                listCanvases(resolvedApiBaseUrl, episodeId),
            ]);
            const nextVisualClips = toVisualClips(nextCanvasItems);

            setMediaItems(nextMediaItems);
            setCanvasItems(nextCanvasItems);
            setEditableVisualClips(nextVisualClips);
            setDirtyImageCompositionCanvasIds([]);
            setActiveCutCanvasId((current) => {
                const nextCanvasIds = new Set(nextCanvasItems.map((item) => item.id));

                if (typeof current === 'number' && nextCanvasIds.has(current)) {
                    return current;
                }

                return nextVisualClips.find((clip) => typeof clip.canvasId === 'number')?.canvasId ?? nextCanvasItems[0]?.id ?? null;
            });
            setMediaContextMenu(null);
            setRangeSelectionIds((current) => current.filter((id) => id !== deletedClipId));
            setEffectsById((current) => {
                if (!deletedClipId || !(deletedClipId in current)) {
                    return current;
                }

                const next = { ...current };
                delete next[deletedClipId];
                return next;
            });
            setSelectedId((current) => {
                if (current !== deletedClipId) {
                    return current;
                }

                return nextVisualClips[0]?.id ?? '';
            });
        } catch (error) {
            setMediaUploadState({
                status: 'idle',
                error: error instanceof Error ? error.message : '미디어 삭제에 실패했습니다.',
            });
        } finally {
            setDeletingMediaId(null);
        }
    };

    const handleStartVisualCutEdit = ({
        event,
        clip,
        index,
        mode,
    }: VisualCutPointerEditRequest) => {
        if (isPreviewLocked) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsPlaying(false);
        setSelectedId(clip.id);
        setRangeSelectionIds([]);
        setVisualCutPointerEdit({
            clipId: clip.id,
            mode,
            pointerStartY: event.clientY,
            originalBlockHeight: Math.max(1, event.currentTarget.getBoundingClientRect().height),
            originalIndex: index,
            originalDuration: clip.duration,
        });
    };

    const handleMoveVisualCutEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!visualCutPointerEdit || isPreviewLocked) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const targetCanvasId = editableVisualClips.find((clip) => clip.id === visualCutPointerEdit.clipId)?.canvasId;

        if (typeof targetCanvasId !== 'number') {
            return;
        }

        markImageCompositionCanvasDirty(targetCanvasId);

        if (visualCutPointerEdit.mode === 'duration') {
            const nextDuration = Math.max(1, Number((visualCutPointerEdit.originalDuration + (event.clientY - visualCutPointerEdit.pointerStartY) / 80).toFixed(2)));

            setEditableVisualClips((current) =>
                reflowVisualClipsForCanvas(
                    current.map((clip) =>
                        clip.id === visualCutPointerEdit.clipId
                            ? {
                                  ...clip,
                                  duration: nextDuration,
                              }
                            : clip,
                    ),
                    targetCanvasId,
                ),
            );
            return;
        }

        setEditableVisualClips((current) => {
            const targetIndex = visualCutPointerEdit.originalIndex + Math.round((event.clientY - visualCutPointerEdit.pointerStartY) / visualCutPointerEdit.originalBlockHeight);

            return moveVisualClipWithinCanvas(current, visualCutPointerEdit.clipId, targetIndex, targetCanvasId);
        });
    };

    const handleEndVisualCutEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!visualCutPointerEdit) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        setVisualCutPointerEdit(null);
    };

    const handleStepTimelineItem = (itemKind: TimelineItemKind, itemId: string, edge: 'start' | 'end', deltaSeconds: number) => {
        if (itemKind === 'scroll') {
            const targetScrollEvent = scrollEventById.get(itemId);

            if (!targetScrollEvent) {
                return;
            }

            const currentEnd = targetScrollEvent.start + targetScrollEvent.duration;
            const nextScrollEvent =
                edge === 'start'
                    ? (() => {
                          const nextStart = getTimelineEditSeconds(
                              clamp(targetScrollEvent.start + deltaSeconds, 0, currentEnd - MIN_TIMELINE_ITEM_DURATION_SECONDS),
                              isSnapEnabled,
                          );

                          return {
                              ...targetScrollEvent,
                              start: nextStart,
                              duration: Math.max(MIN_TIMELINE_ITEM_DURATION_SECONDS, currentEnd - nextStart),
                          };
                      })()
                    : (() => {
                          const nextEnd = getTimelineEditSeconds(
                              Math.max(targetScrollEvent.start + MIN_TIMELINE_ITEM_DURATION_SECONDS, currentEnd + deltaSeconds),
                              isSnapEnabled,
                          );

                          return {
                              ...targetScrollEvent,
                              duration: Math.max(MIN_TIMELINE_ITEM_DURATION_SECONDS, nextEnd - targetScrollEvent.start),
                          };
                      })();

            setScrollEvents((current) => current.map((scrollEvent) => (scrollEvent.id === itemId ? nextScrollEvent : scrollEvent)));
            void persistScrollEventUpdate(nextScrollEvent);
            return;
        }

        if (itemKind === 'video') {
            const targetClip = visualClipById.get(itemId);

            if (!targetClip) {
                return;
            }

            const currentEnd = targetClip.start + targetClip.duration;
            const maxDuration = getVideoTimelineClipMaxDurationSeconds(targetClip);
            const minDuration = getTimelineResizeMinDurationSeconds(maxDuration, MIN_TIMELINE_ITEM_DURATION_SECONDS);
            const nextClip =
                edge === 'start'
                    ? (() => {
                          const nextStart = getTimelineEditSeconds(clamp(targetClip.start + deltaSeconds, 0, currentEnd - minDuration), isSnapEnabled);
                          const nextTiming = clampTimelineAudioResizeTiming({
                              edge: 'start',
                              start: nextStart,
                              duration: Math.max(minDuration, currentEnd - nextStart),
                              itemEnd: currentEnd,
                              maxDuration,
                              minDuration,
                          });

                          return {
                              ...targetClip,
                              hasTimelineControls: true,
                              start: nextTiming.start,
                              duration: nextTiming.duration,
                          };
                      })()
                    : (() => {
                          const nextEnd = getTimelineEditSeconds(Math.max(targetClip.start + minDuration, currentEnd + deltaSeconds), isSnapEnabled);
                          const nextTiming = clampTimelineAudioResizeTiming({
                              edge: 'end',
                              start: targetClip.start,
                              duration: Math.max(minDuration, nextEnd - targetClip.start),
                              itemEnd: nextEnd,
                              maxDuration,
                              minDuration,
                          });

                          return {
                              ...targetClip,
                              hasTimelineControls: true,
                              duration: nextTiming.duration,
                          };
                      })();
            const nextVisualClips = editableVisualClips.map((clip) => (clip.id === itemId ? nextClip : clip));

            setEditableVisualClips(nextVisualClips);
            void persistVideoTimelineUpdate(nextClip, nextVisualClips);
            return;
        }

        const targetClip = audioClipById.get(itemId);

        if (targetClip && lockedTrackIds.includes(targetClip.track)) {
            return;
        }

        if (!targetClip) {
            return;
        }

        const currentEnd = targetClip.start + targetClip.duration;
        const maxDuration = getTimelineAudioClipMaxDurationSeconds(targetClip);
        const minDuration = getTimelineResizeMinDurationSeconds(maxDuration, MIN_TIMELINE_ITEM_DURATION_SECONDS);
        const nextClip =
            edge === 'start'
                ? (() => {
                      const nextStart = getTimelineEditSeconds(clamp(targetClip.start + deltaSeconds, 0, currentEnd - minDuration), isSnapEnabled);
                      const nextTiming = clampTimelineAudioResizeTiming({
                          edge: 'start',
                          start: nextStart,
                          duration: Math.max(minDuration, currentEnd - nextStart),
                          itemEnd: currentEnd,
                          maxDuration,
                          minDuration,
                      });

                      return {
                          ...targetClip,
                          start: nextTiming.start,
                          duration: nextTiming.duration,
                      };
                  })()
                : (() => {
                      const nextEnd = getTimelineEditSeconds(Math.max(targetClip.start + minDuration, currentEnd + deltaSeconds), isSnapEnabled);
                      const nextTiming = clampTimelineAudioResizeTiming({
                          edge: 'end',
                          start: targetClip.start,
                          duration: Math.max(minDuration, nextEnd - targetClip.start),
                          itemEnd: nextEnd,
                          maxDuration,
                          minDuration,
                      });

                      return {
                          ...targetClip,
                          duration: nextTiming.duration,
                      };
                  })();

        setTimelineData((current) => ({
            ...current,
            timelineClips: current.timelineClips.map((clip) => (clip.id === itemId ? nextClip : clip)),
        }));
        void persistCueTimingUpdate(nextClip);
    };

    const handleUpdateVideoClipControls = (clipId: string, patch: VideoClipControlPatch, options: { persist?: boolean } = {}) => {
        const targetClip = visualClipById.get(clipId);

        if (!targetClip || targetClip.mediaType !== 'video') {
            return;
        }

        const nextClip = {
            ...targetClip,
            ...(typeof patch.sourceStart === 'number'
                ? { sourceStart: Number.isFinite(patch.sourceStart) ? Math.max(0, Number(patch.sourceStart.toFixed(2))) : targetClip.sourceStart }
                : {}),
            ...(typeof patch.sourceEnd === 'number'
                ? { sourceEnd: Number.isFinite(patch.sourceEnd) && patch.sourceEnd > 0 ? Math.max(0, Number(patch.sourceEnd.toFixed(2))) : undefined }
                : {}),
            ...(typeof patch.volume === 'number'
                ? { volume: Number.isFinite(patch.volume) ? clamp(Number(patch.volume.toFixed(2)), 0, 1) : targetClip.volume }
                : {}),
            ...(typeof patch.isMuted === 'boolean' ? { isMuted: patch.isMuted } : {}),
        };
        const sourceStart = nextClip.sourceStart ?? 0;
        const normalizedClip =
            typeof nextClip.sourceEnd === 'number' && nextClip.sourceEnd <= sourceStart
                ? {
                      ...nextClip,
                      sourceEnd: Number((sourceStart + MIN_TIMELINE_ITEM_DURATION_SECONDS).toFixed(2)),
                  }
                : nextClip;
        const maxDuration = getVideoTimelineClipMaxDurationSeconds(normalizedClip);
        const durationCappedClip =
            typeof maxDuration === 'number' && normalizedClip.duration > maxDuration
                ? {
                      ...normalizedClip,
                      hasTimelineControls: true,
                      duration: Number(maxDuration.toFixed(2)),
                  }
                : normalizedClip;
        const nextVisualClips = editableVisualClips.map((clip) => (clip.id === clipId ? durationCappedClip : clip));

        setEditableVisualClips(nextVisualClips);

        if (options.persist) {
            void persistVideoTimelineUpdate(durationCappedClip, nextVisualClips);
        }
    };

    const handleNudgeScrollPosition = (itemId: string, edge: 'start' | 'end', deltaPx: number) => {
        const targetScrollEvent = scrollEventById.get(itemId);

        if (!targetScrollEvent) {
            return;
        }

        const currentPixel =
            edge === 'start'
                ? getScrollEventStartPixel(targetScrollEvent, previewStripHeightPx, previewVisualSegments)
                : getScrollEventEndPixel(targetScrollEvent, previewStripHeightPx, previewVisualSegments);
        const anchor = getPreviewScrollAnchor({
            stripPositionPx: currentPixel + deltaPx,
            stripHeightPx: previewStripHeightPx,
            visualSegments: previewVisualSegments,
        });
        const nextAnchoredScrollEvent = applyScrollAnchorToEvent(targetScrollEvent, edge, anchor);
        const nextScrollEvent = {
            ...nextAnchoredScrollEvent,
            sublabel: formatScrollRangeLabel(
                nextAnchoredScrollEvent.startIndex,
                nextAnchoredScrollEvent.startPosition,
                nextAnchoredScrollEvent.endIndex,
                nextAnchoredScrollEvent.endPosition,
            ),
        };

        setScrollEvents((current) => current.map((scrollEvent) => (scrollEvent.id === itemId ? nextScrollEvent : scrollEvent)));
        void persistScrollEventUpdate(nextScrollEvent);
    };

    const handleDeleteTimelineItem = async (itemKind: TimelineItemKind, itemId: string) => {
        if (itemKind === 'scroll') {
            const targetScrollEvent = scrollEventById.get(itemId);
            const scrollId = targetScrollEvent ? getScrollEventApiId(targetScrollEvent) : undefined;

            if (targetScrollEvent && scrollId !== undefined) {
                try {
                    await deleteScrollEvent(resolvedApiBaseUrl, targetScrollEvent.track, scrollId);
                    await refreshTimelineTracks();
                    setSelectedId((current) => (current === itemId ? activeVisual?.id ?? '' : current));
                    setTrackLoadError(null);
                } catch (error) {
                    setTrackLoadError(error instanceof Error ? `스크롤 이벤트 삭제에 실패했습니다: ${error.message}` : '스크롤 이벤트 삭제에 실패했습니다.');
                }

                return;
            }

            setScrollEvents((current) => current.filter((scrollEvent) => scrollEvent.id !== itemId));
            setSelectedId((current) => (current === itemId ? activeVisual?.id ?? '' : current));
            return;
        }

        const targetClip = audioClipById.get(itemId);

        if (targetClip && lockedTrackIds.includes(targetClip.track)) {
            return;
        }

        if (targetClip) {
            const target = toCueMutationTarget(targetClip);

            if (target) {
                try {
                    await deleteCue(resolvedApiBaseUrl, target.trackId, target.cueId);
                    await refreshTimelineTracks();
                    setSelectedId((current) => (current === itemId ? activeVisual?.id ?? '' : current));
                    setTrackLoadError(null);
                } catch (error) {
                    setTrackLoadError(error instanceof Error ? `큐 삭제에 실패했습니다: ${error.message}` : '큐 삭제에 실패했습니다.');
                }

                return;
            }
        }

        setTimelineData((current) => ({
            ...current,
            timelineClips: current.timelineClips.filter((clip) => clip.id !== itemId),
        }));
        setSelectedId((current) => (current === itemId ? activeVisual?.id ?? '' : current));
    };

    const handleApplyEffect = (effectId: EffectId) => {
        const targetId = anchorBySelectionId.has(selectedId) ? activeVisual?.id : selectedId || activeVisual?.id;

        if (!targetId) {
            return;
        }

        setEffectsById((current) => {
            const targetItem = getSelectedItem(targetId, visualClipById, audioClipById, scrollEventById, anchorBySelectionId);
            const existing = current[targetId] ?? (targetItem && 'effects' in targetItem ? targetItem.effects : undefined) ?? [];

            if (existing.includes(effectId)) {
                return current;
            }

            return {
                ...current,
                [targetId]: [...existing, effectId],
            };
        });
    };

    const handleToggleCharacterCreate = () => {
        if (isCreatingCharacter) {
            return;
        }
        setCharacterCreateError(null);

        if (isCharacterCreateOpen) {
            setIsCharacterCreateOpen(false);
            setCharacterCreateDraft({ ...initialCharacterCreateDraft });
            return;
        }

        setIsCharacterCreateOpen(true);
    };

    const handleCharacterCreateDraftChange = (draft: CharacterCreateDraft) => {
        setCharacterCreateDraft(draft);
        setCharacterCreateError(null);
    };

    const handleCreateCharacter = async () => {
        const name = characterCreateDraft.name.trim();
        const imageUrl = characterCreateDraft.imageUrl.trim();

        if (!name) {
            setCharacterCreateError('캐릭터 이름을 입력해주세요.');
            return;
        }

        try {
            setIsCreatingCharacter(true);
            setCharacterCreateError(null);
            await createCharacter(resolvedApiBaseUrl, productId, {
                name,
                role: characterCreateDraft.role,
                imageUrl: imageUrl || undefined,
            });

            const nextCharacters = await listCharacters(resolvedApiBaseUrl, productId);

            setCharacters(toCharacterDefinitions(nextCharacters));
            setCharacterCreateDraft({ ...initialCharacterCreateDraft });
            setIsCharacterCreateOpen(false);
            setActivePanelId('char');
        } catch (error) {
            setCharacterCreateError(error instanceof Error ? error.message : '캐릭터 등록에 실패했습니다.');
        } finally {
            setIsCreatingCharacter(false);
        }
    };

    const handleAddMedia = async (files: File[]) => {
        if (files.length === 0) {
            return;
        }

        const uploadQueue = buildMediaUploadQueue({
            episodeId,
            files,
            getMediaType: getMediaTypeFromFile,
            getUploadKey: getMediaUploadKey,
        });
        const failures: MediaUploadFailure[] = [...uploadQueue.failures];

        if (uploadQueue.items.length === 0) {
            setMediaUploadState({
                status: 'idle',
                error: toMediaUploadFailureMessage(failures),
                failures,
            });
            return;
        }

        let uploadUrls: FileUploadUrlItem[];
        const uploadRequests = buildFileUploadUrlRequests(uploadQueue.items);

        try {
            uploadUrls = await getFileUploadUrls(resolvedApiBaseUrl, uploadRequests);
        } catch (error) {
            const message = error instanceof Error ? error.message : '업로드 URL 발급에 실패했습니다.';

            failures.push(
                ...uploadQueue.items.map((item) => ({
                    fileName: item.fileName,
                    error: message,
                })),
            );
            setMediaUploadState({
                status: 'idle',
                error: toMediaUploadFailureMessage(failures),
                failures,
            });
            return;
        }

        let successCount = 0;

        for (const [itemIndex, item] of uploadQueue.items.entries()) {
            const uploadUrl = uploadUrls[itemIndex];
            const uploadRequest = uploadRequests[itemIndex];

            if (!uploadUrl) {
                failures.push({
                    fileName: item.fileName,
                    error: 'File upload URL response is empty',
                });
                continue;
            }

            try {
                setMediaUploadState({
                    status: 'uploading',
                    fileName: item.fileName,
                    failures: failures.length > 0 ? [...failures] : undefined,
                });
                await uploadFileToPresignedUrl(
                    uploadUrl.presignedUrl,
                    item.file,
                    uploadRequest?.contentType ?? uploadUrl.mimetype,
                );

                setMediaUploadState({
                    status: 'registering',
                    fileName: item.fileName,
                    failures: failures.length > 0 ? [...failures] : undefined,
                });
                const duration = item.mediaType === 'video' ? await getVideoDuration(item.file) : undefined;
                await createMedia(
                    resolvedApiBaseUrl,
                    episodeId,
                    buildMediaRegistrationRequest({
                        duration,
                        item,
                        mediaUrl: uploadUrl.publicUrl,
                    }),
                );
                successCount += 1;
            } catch (error) {
                failures.push({
                    fileName: item.fileName,
                    error: error instanceof Error ? error.message : '미디어 등록에 실패했습니다.',
                });
            }
        }

        if (successCount > 0) {
            const [nextMediaItems, nextCanvasItems] = await Promise.all([
                listMedias(resolvedApiBaseUrl, episodeId),
                listCanvases(resolvedApiBaseUrl, episodeId),
            ]);
            const nextVisualClips = toVisualClips(nextCanvasItems);

            setMediaItems(nextMediaItems);
            setCanvasItems(nextCanvasItems);
            setEditableVisualClips(nextVisualClips);
            setDirtyImageCompositionCanvasIds([]);
            setActiveCutCanvasId((current) => {
                const nextCanvasIds = new Set(nextCanvasItems.map((item) => item.id));

                if (typeof current === 'number' && nextCanvasIds.has(current)) {
                    return current;
                }

                return nextVisualClips.find((clip) => typeof clip.canvasId === 'number')?.canvasId ?? nextCanvasItems[0]?.id ?? null;
            });
            setSelectedId((current) => {
                if (!current || (isVisualClipId(current) && !nextVisualClips.some((clip) => clip.id === current))) {
                    return nextVisualClips[0]?.id ?? '';
                }

                return current;
            });
            setActivePanelId('assets');
        }

        setMediaUploadState({
            status: 'idle',
            error: toMediaUploadFailureMessage(failures),
            failures: failures.length > 0 ? failures : undefined,
        });
    };

    const handleAddAudio = async (file: File) => {
        const candidateKind = getAudioUploadCandidateKind(file);

        if (!candidateKind) {
            setAudioUploadState({
                status: 'idle',
                fileName: file.name,
                error: '오디오 파일 또는 MP4 파일만 등록할 수 있습니다.',
            });
            return;
        }

        try {
            setAudioUploadState({
                status: candidateKind === 'mp4-video' ? 'extracting' : 'uploading',
                fileName: file.name,
            });

            const preparedUpload = await prepareAudioUploadFile(file);

            if (!preparedUpload) {
                throw new Error('오디오 파일 또는 MP4 파일만 등록할 수 있습니다.');
            }

            const uploadFile = preparedUpload.file;
            const audioType: AudioType = 'audio';
            const key = getAudioUploadKey(episodeId, uploadFile, audioType);
            const contentType = getUploadContentType(uploadFile);
            const durationPromise =
                typeof preparedUpload.duration === 'number'
                    ? Promise.resolve(preparedUpload.duration)
                    : getAudioDuration(uploadFile);

            setAudioUploadState({ status: 'uploading', fileName: preparedUpload.name });

            const [uploadUrl] = await getFileUploadUrls(resolvedApiBaseUrl, [{ key, contentType }]);

            if (!uploadUrl) {
                throw new Error('File upload URL response is empty');
            }

            await uploadFileToPresignedUrl(uploadUrl.presignedUrl, uploadFile, contentType);
            setAudioUploadState({ status: 'registering', fileName: preparedUpload.name });
            const duration = await durationPromise;

            await createAudio(resolvedApiBaseUrl, episodeId, {
                audioType,
                name: preparedUpload.name,
                audioUrl: uploadUrl.publicUrl,
                ...(typeof duration === 'number' ? { duration } : {}),
            });

            const nextAudioItems = await listAudios(resolvedApiBaseUrl, episodeId);

            setAudioItems(nextAudioItems);
            setActivePanelId('audio');
            setAudioUploadState({ status: 'idle' });
        } catch (error) {
            setAudioUploadState({
                status: 'idle',
                fileName: file.name,
                error: error instanceof Error ? error.message : '오디오 등록에 실패했습니다.',
            });
        }
    };

    const handleDropAudioOnTrack = async (trackId: string, seconds: number, audioId: number) => {
        const targetTrack = audioTrackById.get(trackId);
        const targetAudio = audioItems.find((audio) => audio.id === audioId);

        if (!targetTrack || isScrollTrackKind(targetTrack.kind)) {
            setTrackLoadError('오디오는 일반 오디오 트랙에만 배치할 수 있습니다.');
            return;
        }
        if (!targetAudio) {
            setTrackLoadError('드롭한 오디오를 찾을 수 없습니다.');
            return;
        }

        const startSeconds = getTimelineEditSeconds(seconds, isSnapEnabled);
        const startTime = Math.round(startSeconds * 1000);
        const endTime = startTime + (targetAudio.duration ?? 4000);

        try {
            const result = await dropAudioOnTrack(resolvedApiBaseUrl, episodeId, audioId, {
                trackId: Number(trackId),
                startTime,
                endTime,
                volume: 1,
            });
            const [tracks, audios] = await Promise.all([
                listTracks(resolvedApiBaseUrl, episodeId),
                listAudios(resolvedApiBaseUrl, episodeId),
            ]);
            const nextTimelineData = toTimelineData(tracks);

            setTimelineData({
                audioTracks: nextTimelineData.audioTracks,
                timelineClips: nextTimelineData.timelineClips,
            });
            setScrollEvents(nextTimelineData.scrollEvents);
            setAudioItems(audios);
            setFocusedTrackId(String(result.data.track.id));
            setSelectedId(`cue-${result.data.cue.id}`);
            setManualTimelineDurationSeconds((current) => Math.max(current, Math.ceil(endTime / 1000)));
            setTrackLoadError(null);
        } catch (error) {
            setTrackLoadError(error instanceof Error ? `오디오 배치에 실패했습니다: ${error.message}` : '오디오 배치에 실패했습니다.');
        }
    };

    const handleScrub = (seconds: number) => {
        const scrubState = getTimelineScrubState({
            seconds,
            timelineDurationSeconds,
            manualTimelineDurationSeconds,
            isPlaying,
        });

        setIsPlaying(scrubState.isPlaying);
        setManualTimelineDurationSeconds((current) =>
            getTimelineScrubState({
                seconds,
                timelineDurationSeconds,
                manualTimelineDurationSeconds: current,
                isPlaying,
            }).manualTimelineDurationSeconds,
        );
        setPlayhead(scrubState.playhead);
    };

    const handleStartTimelinePointerEdit = ({
        event,
        itemKind,
        item,
        mode,
    }: TimelinePointerEditRequest) => {
        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);
        const targetAudioClip = itemKind === 'audio' ? audioClipById.get(item.id) : undefined;
        const targetVideoClip = itemKind === 'video' ? visualClipById.get(item.id) : undefined;

        event.preventDefault();
        event.stopPropagation();
        captureTarget.setPointerCapture(event.pointerId);
        setIsPlaying(false);
        setSelectedId(item.id);
        setRangeSelectionIds([]);
        setFocusedTrackId(
            itemKind === 'video'
                ? VIDEO_TIMELINE_TRACK_ID
                : (audioClipById.get(item.id) ?? scrollEventById.get(item.id))?.track ?? focusedTrackId,
        );
        setTimelinePointerEdit({
            itemId: item.id,
            itemKind,
            mode,
            pointerStartX: event.clientX,
            originalStart: item.start,
            originalDuration: item.duration,
            maxDuration: targetAudioClip
                ? getTimelineAudioClipMaxDurationSeconds(targetAudioClip)
                : targetVideoClip
                  ? getVideoTimelineClipMaxDurationSeconds(targetVideoClip)
                  : undefined,
        });
    };

    const handleMoveTimelinePointerEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!timelinePointerEdit) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const timing = getTimelineEditTiming(timelinePointerEdit, event.clientX, pxPerSecond, timelineDurationSeconds, isSnapEnabled);

        if (timelinePointerEdit.itemKind === 'scroll') {
            setScrollEvents((current) =>
                current.map((scrollEvent) =>
                    scrollEvent.id === timelinePointerEdit.itemId
                        ? { ...scrollEvent, start: timing.start, duration: timing.duration }
                        : scrollEvent,
                ),
            );
        } else if (timelinePointerEdit.itemKind === 'video') {
            setEditableVisualClips((current) =>
                current.map((clip) =>
                    clip.id === timelinePointerEdit.itemId
                        ? { ...clip, hasTimelineControls: true, start: timing.start, duration: timing.duration }
                        : clip,
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

        if (timelinePointerEdit.itemKind === 'scroll') {
            const targetScrollEvent = scrollEventById.get(timelinePointerEdit.itemId);

            if (targetScrollEvent) {
                const timing = getTimelineEditTiming(timelinePointerEdit, event.clientX, pxPerSecond, timelineDurationSeconds, isSnapEnabled);
                const nextScrollEvent = {
                    ...targetScrollEvent,
                    start: timing.start,
                    duration: timing.duration,
                };

                setScrollEvents((current) => current.map((scrollEvent) => (scrollEvent.id === timelinePointerEdit.itemId ? nextScrollEvent : scrollEvent)));
                setPlayhead(timing.start);
                void persistScrollEventUpdate(nextScrollEvent);
            }
        } else if (timelinePointerEdit.itemKind === 'video') {
            const targetClip = visualClipById.get(timelinePointerEdit.itemId);

            if (targetClip) {
                const timing = getTimelineEditTiming(timelinePointerEdit, event.clientX, pxPerSecond, timelineDurationSeconds, isSnapEnabled);
                const nextClip = {
                    ...targetClip,
                    hasTimelineControls: true,
                    start: timing.start,
                    duration: timing.duration,
                };
                const nextVisualClips = editableVisualClips.map((clip) => (clip.id === timelinePointerEdit.itemId ? nextClip : clip));

                setEditableVisualClips(nextVisualClips);
                setPlayhead(timing.start);
                void persistVideoTimelineUpdate(nextClip, nextVisualClips);
            }
        } else {
            const targetClip = audioClipById.get(timelinePointerEdit.itemId);

            if (targetClip && !lockedTrackIds.includes(targetClip.track)) {
                const timing = getTimelineEditTiming(timelinePointerEdit, event.clientX, pxPerSecond, timelineDurationSeconds, isSnapEnabled);
                const nextClip = {
                    ...targetClip,
                    start: timing.start,
                    duration: timing.duration,
                };

                setTimelineData((current) => ({
                    ...current,
                    timelineClips: current.timelineClips.map((clip) => (clip.id === timelinePointerEdit.itemId ? nextClip : clip)),
                }));
                setPlayhead(timing.start);
                void persistCueTimingUpdate(nextClip);
            }
        }

        setTimelinePointerEdit(null);
    };

    const handleStartTimelineAnchorEdit = ({
        event,
        anchor,
    }: TimelineAnchorPointerEditRequest) => {
        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);

        event.preventDefault();
        event.stopPropagation();
        captureTarget.setPointerCapture(event.pointerId);
        setIsPlaying(false);
        setSelectedId(getAnchorSelectionId(anchor.id));
        setRangeSelectionIds([]);
        setFocusedTrackId(String(anchor.trackId));
        setPlayhead(toTimelineSeconds(anchor.time));
        setTimelineAnchorPointerEdit({
            anchor,
            pointerStartX: event.clientX,
            originalTimeSeconds: toTimelineSeconds(anchor.time),
            hasMoved: false,
        });
    };

    const handleMoveTimelineAnchorEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!timelineAnchorPointerEdit) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const request = getTimelineAnchorEditRequest(timelineAnchorPointerEdit, event.clientX, pxPerSecond, timelineDurationSeconds, isSnapEnabled);

        if (!request) {
            return;
        }

        const nextAnchor = applyAnchorMutation(timelineAnchorPointerEdit.anchor, request);
        const nextTimeSeconds = toTimelineSeconds(nextAnchor.time);

        setTimelineAnchorPointerEdit((current) =>
            current ? { ...current, hasMoved: current.hasMoved || request.time !== current.anchor.time } : current,
        );
        setAnchors((current) => replaceAnchor(current, nextAnchor));
        setPlayhead(nextTimeSeconds);
        setManualTimelineDurationSeconds((current) => Math.max(current, Math.ceil(nextTimeSeconds)));
    };

    const handleEndTimelineAnchorEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!timelineAnchorPointerEdit) {
            return;
        }

        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);

        event.preventDefault();
        event.stopPropagation();

        if (captureTarget.hasPointerCapture(event.pointerId)) {
            captureTarget.releasePointerCapture(event.pointerId);
        }

        const request = getTimelineAnchorEditRequest(timelineAnchorPointerEdit, event.clientX, pxPerSecond, timelineDurationSeconds, isSnapEnabled);

        if (!request) {
            if (timelineAnchorPointerEdit.hasMoved) {
                setAnchors((current) => replaceAnchor(current, timelineAnchorPointerEdit.anchor));
            }

            setTimelineAnchorPointerEdit(null);
            return;
        }

        if (timelineAnchorPointerEdit.hasMoved || request.time !== timelineAnchorPointerEdit.anchor.time) {
            const nextAnchor = applyAnchorMutation(timelineAnchorPointerEdit.anchor, request);
            const nextTimeSeconds = toTimelineSeconds(nextAnchor.time);

            setAnchors((current) => replaceAnchor(current, nextAnchor));
            setPlayhead(nextTimeSeconds);
            setManualTimelineDurationSeconds((current) => Math.max(current, Math.ceil(nextTimeSeconds)));
            void persistAnchorUpdate(timelineAnchorPointerEdit.anchor, request);
        }

        setTimelineAnchorPointerEdit(null);
    };

    const handleStartTimelineHeightResize = (event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();

        setIsPlaying(false);
        setTimelinePanelResize({
            pointerStartY: event.clientY,
            originalHeight: timelineHeight,
        });
    };

    const handleStartTimelineSidebarResize = (event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();

        setIsPlaying(false);
        setTimelineSidebarResize({
            pointerStartX: event.clientX,
            originalWidth: timelineSidebarWidth,
        });
    };

    const handleStartInspectorResize = (event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();

        setIsPlaying(false);
        setInspectorResize({
            pointerStartX: event.clientX,
            originalWidth: inspectorWidth,
        });
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
        setRangeSelectionIds([]);
        setFocusedTrackId(item.track);
        setPreviewScrollPointerEdit({
            eventId: item.id,
            mode,
            pointerStartY: event.clientY,
            coordinateHeightPx: previewStripHeightPx,
            visualSegments: previewVisualSegments,
            originalStartPixel: getScrollEventStartPixel(item, previewStripHeightPx, previewVisualSegments),
            originalEndPixel: getScrollEventEndPixel(item, previewStripHeightPx, previewVisualSegments),
        });
    };

    const handleMovePreviewScrollEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!previewScrollPointerEdit) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const anchors = getPreviewScrollEditAnchors(previewScrollPointerEdit, event.clientY);

        setScrollEvents((current) =>
            current.map((scrollEvent) =>
                scrollEvent.id === previewScrollPointerEdit.eventId
                    ? (() => {
                          const nextScrollEvent = applyScrollAnchorToEvent(
                              applyScrollAnchorToEvent(scrollEvent, 'start', anchors.start),
                              'end',
                              anchors.end,
                          );

                          return {
                              ...nextScrollEvent,
                              sublabel: formatScrollRangeLabel(
                                  nextScrollEvent.startIndex,
                                  nextScrollEvent.startPosition,
                                  nextScrollEvent.endIndex,
                                  nextScrollEvent.endPosition,
                              ),
                          };
                      })()
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

        const targetScrollEvent = scrollEventById.get(previewScrollPointerEdit.eventId);

        if (targetScrollEvent) {
            const anchors = getPreviewScrollEditAnchors(previewScrollPointerEdit, event.clientY);
            const nextScrollEvent = applyScrollAnchorToEvent(
                applyScrollAnchorToEvent(targetScrollEvent, 'start', anchors.start),
                'end',
                anchors.end,
            );
            const nextPersistableScrollEvent = {
                ...nextScrollEvent,
                sublabel: formatScrollRangeLabel(
                    nextScrollEvent.startIndex,
                    nextScrollEvent.startPosition,
                    nextScrollEvent.endIndex,
                    nextScrollEvent.endPosition,
                ),
            };

            setScrollEvents((current) => current.map((scrollEvent) => (scrollEvent.id === previewScrollPointerEdit.eventId ? nextPersistableScrollEvent : scrollEvent)));
            void persistScrollEventUpdate(nextPersistableScrollEvent);
        }

        setPreviewScrollPointerEdit(null);
    };

    const handleStartPreviewAnchorEdit = ({
        event,
        anchor,
        top,
    }: PreviewAnchorPointerEditRequest) => {
        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);

        event.preventDefault();
        event.stopPropagation();
        captureTarget.setPointerCapture(event.pointerId);
        setIsPlaying(false);
        setSelectedId(getAnchorSelectionId(anchor.id));
        setRangeSelectionIds([]);
        setFocusedTrackId(String(anchor.trackId));
        setPlayhead(toTimelineSeconds(anchor.time));
        setPreviewAnchorPointerEdit({
            anchor,
            pointerStartY: event.clientY,
            coordinateHeightPx: previewStripHeightPx,
            visualSegments: previewVisualSegments,
            originalPixel: top,
            hasMoved: false,
        });
    };

    const handleMovePreviewAnchorEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!previewAnchorPointerEdit) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const request = getPreviewAnchorEditRequest(previewAnchorPointerEdit, event.clientY);

        if (!request) {
            return;
        }

        const nextAnchor = applyAnchorMutation(previewAnchorPointerEdit.anchor, request);

        setPreviewAnchorPointerEdit((current) => (current ? { ...current, hasMoved: true } : current));
        setAnchors((current) => replaceAnchor(current, nextAnchor));
    };

    const handleEndPreviewAnchorEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!previewAnchorPointerEdit) {
            return;
        }

        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);

        event.preventDefault();
        event.stopPropagation();

        if (captureTarget.hasPointerCapture(event.pointerId)) {
            captureTarget.releasePointerCapture(event.pointerId);
        }

        const request = getPreviewAnchorEditRequest(previewAnchorPointerEdit, event.clientY);

        if (!request) {
            if (previewAnchorPointerEdit.hasMoved) {
                setAnchors((current) => replaceAnchor(current, previewAnchorPointerEdit.anchor));
            }

            setPreviewAnchorPointerEdit(null);
            return;
        }

        if (previewAnchorPointerEdit.hasMoved) {
            const nextAnchor = applyAnchorMutation(previewAnchorPointerEdit.anchor, request);

            setAnchors((current) => replaceAnchor(current, nextAnchor));
            void persistAnchorUpdate(previewAnchorPointerEdit.anchor, request);
        }

        setPreviewAnchorPointerEdit(null);
    };

    const handleStartPreviewCueEdit = ({ event, marker }: PreviewCuePointerEditRequest) => {
        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);
        const activeCueVisualClips = filterPreviewCanvasItems(editableVisualClips, activeStageCanvasId);

        event.preventDefault();
        event.stopPropagation();
        captureTarget.setPointerCapture(event.pointerId);
        setIsPlaying(false);
        setSelectedId(marker.cueId);
        setRangeSelectionIds([]);
        setFocusedTrackId(marker.trackId);
        setPlayhead(toTimelineSeconds(marker.cue.startTime));
        setPreviewCuePointerEdit({
            cue: marker.cue,
            trackId: marker.trackId,
            pointerStartY: event.clientY,
            coordinateHeightPx: previewStripHeightPx,
            visualClips: activeCueVisualClips,
            visualSegments: previewVisualSegments,
            originalStartPixel: marker.top,
            originalEndPixel: marker.endTop,
            hasMoved: false,
        });
    };

    const handleMovePreviewCueEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!previewCuePointerEdit) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const request = getPreviewCueEditRequest(previewCuePointerEdit, event.clientY);

        if (!request) {
            return;
        }

        const nextCue = applyCuePositionMutation(previewCuePointerEdit.cue, request);

        setPreviewCuePointerEdit((current) => (current ? { ...current, hasMoved: true } : current));
        setTracks((current) => replaceCueInTracks(current, previewCuePointerEdit.trackId, nextCue));
        setTimelineData((current) => replaceCuePositionInTimelineData(current, nextCue, request));
    };

    const handleEndPreviewCueEdit = (event: ReactPointerEvent<HTMLElement>) => {
        if (!previewCuePointerEdit) {
            return;
        }

        const captureTarget = getTimelinePointerCaptureTarget(event.currentTarget);

        event.preventDefault();
        event.stopPropagation();

        if (captureTarget.hasPointerCapture(event.pointerId)) {
            captureTarget.releasePointerCapture(event.pointerId);
        }

        const request = getPreviewCueEditRequest(previewCuePointerEdit, event.clientY);

        if (!request) {
            if (previewCuePointerEdit.hasMoved) {
                void refreshTimelineTracks();
            }

            setPreviewCuePointerEdit(null);
            return;
        }

        const didMove =
            previewCuePointerEdit.hasMoved ||
            request.startCanvasMediaId !== previewCuePointerEdit.cue.startCanvasMediaId ||
            request.endCanvasMediaId !== previewCuePointerEdit.cue.endCanvasMediaId ||
            request.startPosition !== previewCuePointerEdit.cue.startPosition ||
            request.endPosition !== previewCuePointerEdit.cue.endPosition;

        if (didMove) {
            const nextCue = applyCuePositionMutation(previewCuePointerEdit.cue, request);

            setTracks((current) => replaceCueInTracks(current, previewCuePointerEdit.trackId, nextCue));
            setTimelineData((current) => replaceCuePositionInTimelineData(current, nextCue, request));
            void persistCuePositionUpdate(previewCuePointerEdit, request);
        }

        setPreviewCuePointerEdit(null);
    };

    const handleSaveCueScript = async () => {
        const selectedClip = audioClipById.get(selectedId);
        const nextScript = cueScriptDraft.trim();

        if (!selectedClip) {
            setCueScriptError('대사를 등록할 큐를 선택해 주세요.');
            return;
        }
        if (!nextScript) {
            setCueScriptError('대사를 입력해 주세요.');
            return;
        }

        const cueId = getCueApiIdFromTimelineClipId(selectedClip.id);
        if (!cueId) {
            setCueScriptError('선택한 큐 ID를 확인할 수 없습니다.');
            return;
        }

        const selectedCue = tracks
            .flatMap((track) => track.cues ?? [])
            .find((cue) => String(cue.id) === cueId);
        const cueTrackId = resolveCueTimelineTrackId({
            parentTrackId: selectedClip.track,
            cueTrackId: selectedCue?.trackId,
        });

        try {
            setIsSavingCueScript(true);
            setCueScriptError(null);
            await updateCue(resolvedApiBaseUrl, cueTrackId, cueId, {
                script: nextScript,
            });

            setTimelineData((current) => ({
                ...current,
                timelineClips: current.timelineClips.map((clip) =>
                    clip.id === selectedClip.id
                        ? {
                              ...clip,
                              label: nextScript,
                          }
                        : clip,
                ),
            }));
            setTracks((current) =>
                current.map((track) =>
                    String(track.id) === cueTrackId || (track.cues ?? []).some((cue) => String(cue.id) === cueId)
                        ? {
                              ...track,
                              cues: (track.cues ?? []).map((cue) => (String(cue.id) === cueId ? { ...cue, script: nextScript } : cue)),
                          }
                        : track,
                ),
            );
            setDialogueCues((current) =>
                current.map((cue) => (String(cue.id) === cueId ? { ...cue, script: nextScript } : cue)),
            );
            setCueScriptDraft(nextScript);
            setTrackLoadError(null);
        } catch (error) {
            setCueScriptError(error instanceof Error ? `대사 등록에 실패했습니다: ${error.message}` : '대사 등록에 실패했습니다.');
        } finally {
            setIsSavingCueScript(false);
        }
    };

    const handleAddCue = async () => {
        const selectedClip = audioClipById.get(selectedId);
        const fallbackTrack = timelineData.audioTracks.find((track) => !isScrollTrackKind(track.kind) && track.characterId);
        const targetTrackId = focusedTrackId || selectedClip?.track || fallbackTrack?.id;

        if (!targetTrackId) {
            setTrackLoadError('큐를 추가할 보이스 트랙을 선택해 주세요.');
            return;
        }

        const targetTrack = audioTrackById.get(targetTrackId);
        if (!targetTrack || isScrollTrackKind(targetTrack.kind) || !targetTrack.characterId) {
            setTrackLoadError('큐는 캐릭터가 연결된 보이스 트랙에만 추가할 수 있습니다.');
            return;
        }

        const start = getTimelineEditSeconds(playhead, isSnapEnabled);
        const end = Number((start + 4).toFixed(2));
        setIsPlaying(false);

        try {
            await createCue(resolvedApiBaseUrl, targetTrackId, {
                script: '대사 입력 대기',
                startTime: Math.round(start * 1000),
                endTime: Math.round(end * 1000),
                volume: 1,
            });

            const tracks = await listTracks(resolvedApiBaseUrl, episodeId);
            const nextTimelineData = toTimelineData(tracks);
            const updatedTrack = tracks.find((track) => String(track.id) === targetTrackId);
            const createdCue = [...(updatedTrack?.cues ?? [])].sort((a, b) => b.id - a.id)[0];

            setTracks(tracks);
            setTimelineData({
                audioTracks: nextTimelineData.audioTracks,
                timelineClips: nextTimelineData.timelineClips,
            });
            setScrollEvents(nextTimelineData.scrollEvents);
            setFocusedTrackId(targetTrackId);
            setSelectedId(createdCue ? `cue-${createdCue.id}` : '');
            setRangeSelectionIds([]);
            setPlayhead(start);
            setTrackLoadError(null);
        } catch (error) {
            setTrackLoadError(error instanceof Error ? `큐 추가에 실패했습니다: ${error.message}` : '큐 추가에 실패했습니다.');
        }
    };

    const handleToggleCutCuePlacement = () => {
        if (cutCuePlacementTrackId) {
            setCutCuePlacementTrackId(null);
            return;
        }

        if (!cutCueTargetTrackId) {
            setTrackLoadError('큐를 추가할 보이스 트랙을 먼저 생성해 주세요.');
            return;
        }

        setAnchorPlacementTrackId(null);
        setCutCuePlacementTrackId(cutCueTargetTrackId);
        setFocusedTrackId(cutCueTargetTrackId);
        setPreviewMode('cutEdit');
        setTrackLoadError(null);
    };

    const handlePlaceCutCue = async (stripPositionPx: number, stripHeightPx: number) => {
        const targetTrackId = cutCueTargetTrackId;
        const targetTrack = audioTrackById.get(targetTrackId);

        if (!cutCuePlacementTrackId || !targetTrackId) {
            setTrackLoadError('큐 위치를 등록할 보이스 트랙을 선택해 주세요.');
            return;
        }
        if (!targetTrack || isScrollTrackKind(targetTrack.kind) || !targetTrack.characterId) {
            setTrackLoadError('큐는 캐릭터가 연결된 보이스 트랙에만 추가할 수 있습니다.');
            return;
        }

        const request = toClickedCuePositionRequest({
            stripHeightPx,
            stripPositionPx,
            visualClips: filterPreviewCanvasItems(editableVisualClips, resolvedActiveCutCanvasId),
            visualSegments: previewVisualSegments,
        });

        if (!request) {
            setTrackLoadError('큐를 추가할 캔버스 미디어 위치를 확인할 수 없습니다. 컷 편집 변경사항을 먼저 저장해 주세요.');
            return;
        }

        try {
            setIsAddingCutCue(true);
            setIsPlaying(false);
            await createCue(resolvedApiBaseUrl, targetTrackId, {
                script: '대사 입력 대기',
                ...request,
                volume: 1,
            });

            const tracks = await listTracks(resolvedApiBaseUrl, episodeId);
            const nextTimelineData = toTimelineData(tracks);
            const updatedTrack = tracks.find((track) => String(track.id) === targetTrackId);
            const createdCue = [...(updatedTrack?.cues ?? [])].sort((a, b) => b.id - a.id)[0];

            setTracks(tracks);
            setTimelineData({
                audioTracks: nextTimelineData.audioTracks,
                timelineClips: nextTimelineData.timelineClips,
            });
            setScrollEvents(nextTimelineData.scrollEvents);
            setFocusedTrackId(targetTrackId);
            setSelectedId(createdCue ? `cue-${createdCue.id}` : '');
            setRangeSelectionIds([]);
            setCutCuePlacementTrackId(null);
            setTrackLoadError(null);
        } catch (error) {
            setTrackLoadError(error instanceof Error ? `컷 큐 추가에 실패했습니다: ${error.message}` : '컷 큐 추가에 실패했습니다.');
        } finally {
            setIsAddingCutCue(false);
        }
    };

    const handleToggleAnchorPlacement = async () => {
        if (isAddingAnchor) {
            return;
        }
        if (anchorPlacementTrackId) {
            setAnchorPlacementTrackId(null);
            return;
        }

        const selectedScrollEvent = scrollEventById.get(selectedId);
        const targetTrackId = resolveAnchorPlacementTrackId({
            selectedScrollTrackId: selectedScrollEvent?.track,
            focusedTrackId,
            tracks: timelineData.audioTracks,
        });

        if (targetTrackId) {
            setCutCuePlacementTrackId(null);
            setAnchorPlacementTrackId(targetTrackId);
            setPreviewMode('cutEdit');
            setTrackLoadError(null);
            return;
        }

        const trackName = getDefaultTrackName('scroll');

        try {
            setIsAddingAnchor(true);
            setTrackLoadError(null);

            await createTrack(resolvedApiBaseUrl, episodeId, {
                name: trackName,
                type: 'scroll',
                isMuted: false,
            });

            const tracks = await listTracks(resolvedApiBaseUrl, episodeId);
            const nextTimelineData = toTimelineData(tracks);
            const nextAnchors = await listAnchorsForTracks(
                resolvedApiBaseUrl,
                nextTimelineData.audioTracks.filter((track) => isScrollTrackKind(track.kind)).map((track) => track.id),
            );
            const createdTrack =
                [...tracks]
                    .filter((track) => track.name === trackName && isScrollTrackKind(track.type))
                    .sort((a, b) => b.id - a.id)[0] ?? tracks.find((track) => isScrollTrackKind(track.type));

            if (!createdTrack) {
                throw new Error('Created scroll track was not found.');
            }

            setTracks(tracks);
            setTimelineData({
                audioTracks: nextTimelineData.audioTracks,
                timelineClips: nextTimelineData.timelineClips,
            });
            setScrollEvents(nextTimelineData.scrollEvents);
            setAnchors(nextAnchors);
            setCutCuePlacementTrackId(null);
            setAnchorPlacementTrackId(String(createdTrack.id));
            setFocusedTrackId(String(createdTrack.id));
            setPreviewMode('cutEdit');
            setTrackLoadError(null);
        } catch (error) {
            setTrackLoadError(
                error instanceof Error
                    ? `앵커용 스크롤 트랙을 생성하지 못했습니다: ${error.message}`
                    : '앵커용 스크롤 트랙을 생성하지 못했습니다.',
            );
        } finally {
            setIsAddingAnchor(false);
        }
    };

    const handlePlaceAnchor = async (stripPositionPx: number, stripHeightPx: number) => {
        if (!anchorPlacementTrackId) {
            setTrackLoadError('앵커를 추가할 스크롤 트랙을 선택해 주세요.');
            return;
        }

        const request = toClickedScrollAnchorMutationRequest({
            playhead,
            stripHeightPx,
            stripPositionPx,
            visualSegments: previewVisualSegments,
        });

        if (!request) {
            setTrackLoadError('앵커를 추가할 기준 이미지 위치를 확인할 수 없습니다.');
            return;
        }

        try {
            setIsAddingAnchor(true);
            setIsPlaying(false);
            const createdAnchor = await createAnchor(resolvedApiBaseUrl, anchorPlacementTrackId, request);

            setAnchors((current) =>
                [...current.filter((anchor) => anchor.id !== createdAnchor.id), createdAnchor].sort(
                    (a, b) => a.time - b.time || a.id - b.id,
                ),
            );
            setFocusedTrackId(anchorPlacementTrackId);
            setAnchorPlacementTrackId(null);
            setTrackLoadError(null);
        } catch (error) {
            setTrackLoadError(error instanceof Error ? `앵커 추가에 실패했습니다: ${error.message}` : '앵커 추가에 실패했습니다.');
        } finally {
            setIsAddingAnchor(false);
        }
    };

    const handleConfirmImageComposition = async () => {
        if (isConfirmingImageComposition) {
            return;
        }

        if (typeof resolvedActiveCutCanvasId !== 'number') {
            setImageCompositionConfirmError('수정할 캔버스를 먼저 선택해 주세요.');
            return;
        }

        if (!dirtyImageCompositionCanvasIdSet.has(resolvedActiveCutCanvasId)) {
            return;
        }

        const canvasMedias = toCanvasCreateMedias(imageCompositionDraft, { canvasId: resolvedActiveCutCanvasId });

        try {
            setIsConfirmingImageComposition(true);
            setImageCompositionConfirmError(null);

            await updateCanvas(resolvedApiBaseUrl, episodeId, resolvedActiveCutCanvasId, { medias: canvasMedias });

            const nextCanvasItems = await listCanvases(resolvedApiBaseUrl, episodeId);
            const nextVisualClips = toVisualClips(nextCanvasItems);
            const nextImageCompositionSources = toImageCompositionSources(nextVisualClips);
            const confirmedAt = new Date().toISOString();

            setCanvasItems(nextCanvasItems);
            setEditableVisualClips(nextVisualClips);
            setDirtyImageCompositionCanvasIds((current) => current.filter((canvasId) => canvasId !== resolvedActiveCutCanvasId));
            setActiveCutCanvasId((current) => {
                const nextCanvasIds = new Set(nextCanvasItems.map((item) => item.id));

                if (typeof current === 'number' && nextCanvasIds.has(current)) {
                    return current;
                }

                return nextVisualClips.find((clip) => typeof clip.canvasId === 'number')?.canvasId ?? nextCanvasItems[0]?.id ?? null;
            });
            setSelectedId((current) => {
                if (!current || (isVisualClipId(current) && !nextVisualClips.some((clip) => clip.id === current))) {
                    return nextVisualClips[0]?.id ?? '';
                }

                return current;
            });
            setImageCompositionDraft((current) =>
                confirmImageCompositionDraft(syncImageCompositionDraft(nextImageCompositionSources, current), confirmedAt),
            );
        } catch (error) {
            setImageCompositionConfirmError(error instanceof Error ? error.message : 'Canvas save failed.');
        } finally {
            setIsConfirmingImageComposition(false);
        }
    };

    const handleOpenTrackModal = () => {
        setNewTrackType('record');
        setNewTrackName('');
        setNewTrackCharacterId('');
        setTrackModalError(null);
        setIsTrackModalOpen(true);
    };

    const handleCloseTrackModal = () => {
        if (isCreatingTrack) {
            return;
        }

        setIsTrackModalOpen(false);
        setTrackModalError(null);
    };

    const handleAddTrack = async () => {
        if (isCreatingTrack) {
            return;
        }

        const trackType = newTrackType;
        const selectedCharacter = trackType === 'record' ? selectedTrackCharacter : undefined;

        if (trackType === 'record' && !selectedCharacter) {
            setTrackModalError('캐릭터를 선택해야 캐릭터 보이스 트랙을 생성할 수 있습니다.');
            return;
        }

        const trackName =
            newTrackName.trim() || (selectedCharacter ? `${selectedCharacter.name} 보이스` : getDefaultTrackName(trackType));

        setIsCreatingTrack(true);
        setTrackModalError(null);

        try {
            await createTrack(resolvedApiBaseUrl, episodeId, {
                name: trackName,
                type: trackType,
                characterId: selectedCharacter ? Number(selectedCharacter.id) : undefined,
                isMuted: false,
            });

            const tracks = await listTracks(resolvedApiBaseUrl, episodeId);
            const nextTimelineData = toTimelineData(tracks);
            const createdTrack = [...tracks]
                .filter((track) => track.name === trackName && track.type === trackType)
                .sort((a, b) => b.id - a.id)[0];

            setTimelineData({
                audioTracks: nextTimelineData.audioTracks,
                timelineClips: nextTimelineData.timelineClips,
            });
            setScrollEvents(nextTimelineData.scrollEvents);
            setFocusedTrackId(createdTrack ? String(createdTrack.id) : nextTimelineData.audioTracks[0]?.id ?? '');
            if (previewMode === 'cutEdit' && createdTrack && !isScrollTrackKind(createdTrack.type) && createdTrack.characterId) {
                setCutCuePlacementTrackId(String(createdTrack.id));
            }
            setTrackLoadError(null);
            setIsTrackModalOpen(false);
            setNewTrackName('');
            setNewTrackCharacterId('');
            setRangeSelectionIds([]);
        } catch {
            setTrackModalError('트랙 생성에 실패했습니다. 백엔드 API 상태를 확인해 주세요.');
        } finally {
            setIsCreatingTrack(false);
        }
    };

    return (
        <div className="odx-editor" data-testid="tooned-index-editor">
            <header className="odx-topbar">
                <div className="odx-brand">
                    <span>Tooned</span>
                    <b>Studio</b>
                </div>
                <div className="odx-project">
                    <strong>{episodeTitle}</strong>
                    <span>{episodeMeta}</span>
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
            <main
                className={`odx-body ${previewMode === 'cutEdit' ? 'is-editing-cuts' : ''} ${shouldShowCutEditInspector ? 'has-cut-edit-inspector' : ''} ${inspectorResize ? 'is-inspector-resizing' : ''}`}
                style={
                    {
                        '--odx-inspector-width': `${inspectorWidth}px`,
                        '--odx-timeline-height': `${timelineHeight}px`,
                    } as CSSProperties
                }
            >
                <aside className="odx-rail" aria-label="제작 도구">
                    {panelDefinitions.map((panel) => (
                        <button
                            className={activePanelId === panel.id ? 'is-active' : ''}
                            key={panel.id}
                            onClick={() => {
                                setActivePanelId(panel.id);
                                setMediaContextMenu(null);
                            }}
                            title={panel.title}
                            type="button"
                        >
                            <StudioIcon name={panel.icon} size={20} />
                            <span>{panel.label}</span>
                        </button>
                    ))}
                </aside>
                <LibraryPanel
                    activePanelId={activePanelId}
                    audioItems={audioItems}
                    audioUploadState={audioUploadState}
                    characters={characters}
                    characterCreateState={characterCreateState}
                    deletingMediaId={deletingMediaId}
                    dialogueLines={dialogueLines}
                    dialogueLoadError={dialogueLoadError}
                    isDialogueLoading={isDialogueLoading}
                    mediaItems={mediaItems}
                    mediaContextMenu={mediaContextMenu}
                    mediaUploadState={mediaUploadState}
                    selectedMediaIds={selectedMediaIds}
                    onAddAudio={handleAddAudio}
                    onAddMedia={handleAddMedia}
                    onApplyEffect={handleApplyEffect}
                    onCharacterCreateDraftChange={handleCharacterCreateDraftChange}
                    onCloseMediaContextMenu={handleCloseMediaContextMenu}
                    onCreateCharacter={handleCreateCharacter}
                    onDeleteMedia={handleDeleteMedia}
                    onOpenMediaContextMenu={handleOpenMediaContextMenu}
                    onSelectMedia={handleSelectMedia}
                    onToggleCharacterCreate={handleToggleCharacterCreate}
                />
                <PreviewCanvas
                    activeCutCanvasId={resolvedActiveCutCanvasId}
                    activeVisual={activeVisual}
                    anchors={stageAnchors}
                    canConfirmImageComposition={canConfirmImageComposition}
                    canvasOptions={previewCanvasOptions}
                    canvasSummaries={canvasSummaries}
                    cuePlacementTrackId={cutCueTargetTrackId}
                    cueTracks={cutEditCueTracks}
                    effects={getItemEffects(previewActiveVisual, effectsById)}
                    focusedTrackId={focusedTrackId}
                    imageCompositionConfirmError={imageCompositionConfirmError}
                    isAddingAnchor={isAddingAnchor}
                    isAddingCue={isAddingCutCue}
                    isAnchorPlacementMode={isAnchorPlacementMode}
                    isCuePlacementMode={isCutCuePlacementMode}
                    isConfirmingImageComposition={isConfirmingImageComposition}
                    isPreviewAudioEnabled={isPreviewAudioEnabled}
                    isPreviewFullscreen={isPreviewFullscreen}
                    isPreviewLocked={isPreviewLocked}
                    isPlaying={isPlaying}
                    onFocusTrack={handleFocusTrack}
                    onImageCompositionConfirm={handleConfirmImageComposition}
                    onMediaDrop={handleDropMediaOnCutEditor}
                    onOpenTrackModal={handleOpenTrackModal}
                    onPreviewModeChange={setPreviewMode}
                    onPreviewStripHeightChange={setPreviewStripHeightPx}
                    onPreviewVisualSegmentsChange={setPreviewVisualSegments}
                    onPreviewZoomChange={(zoom) => setPreviewZoom(clamp(zoom, MIN_PREVIEW_ZOOM, MAX_PREVIEW_ZOOM))}
                    onPreviewZoomStep={(delta) => setPreviewZoom((current) => clamp(current + delta, MIN_PREVIEW_ZOOM, MAX_PREVIEW_ZOOM))}
                    onPlaceAnchor={handlePlaceAnchor}
                    onPlaceCue={handlePlaceCutCue}
                    onSelectAnchor={handleSelectAnchor}
                    onSelectCue={(cueId) => handleSelectItem(`cue-${cueId}`)}
                    onSelectCutCanvas={handleSelectCutCanvas}
                    onSelectPreviewCanvas={setSelectedPreviewCanvasId}
                    onSelectVisual={handleSelectVisual}
                    onToggleAnchorPlacement={handleToggleAnchorPlacement}
                    onToggleCuePlacement={handleToggleCutCuePlacement}
                    onSelectScrollEvent={handleSelectItem}
                    onPreviewAnchorEditEnd={handleEndPreviewAnchorEdit}
                    onPreviewAnchorEditMove={handleMovePreviewAnchorEdit}
                    onPreviewAnchorEditStart={handleStartPreviewAnchorEdit}
                    onPreviewCueEditEnd={handleEndPreviewCueEdit}
                    onPreviewCueEditMove={handleMovePreviewCueEdit}
                    onPreviewCueEditStart={handleStartPreviewCueEdit}
                    onPreviewScrollEditEnd={handleEndPreviewScrollEdit}
                    onPreviewScrollEditMove={handleMovePreviewScrollEdit}
                    onPreviewScrollEditStart={handleStartPreviewScrollEdit}
                    onTogglePreviewAudio={() => setIsPreviewAudioEnabled((current) => !current)}
                    onTogglePreviewFullscreen={() => setIsPreviewFullscreen((current) => !current)}
                    onTogglePreviewLock={() => setIsPreviewLocked((current) => !current)}
                    onVisualCutEditEnd={handleEndVisualCutEdit}
                    onVisualCutEditMove={handleMoveVisualCutEdit}
                    onVisualCutEditStart={handleStartVisualCutEdit}
                    playhead={playhead}
                    playbackScrollEvents={stagePlaybackScrollEvents}
                    previewActiveVisual={previewActiveVisual}
                    previewMode={previewMode}
                    previewVisualClips={previewVisualClips}
                    previewZoom={previewZoom}
                    previewStripHeightPx={previewStripHeightPx}
                    previewVisualSegments={previewVisualSegments}
                    previewAnchorEditingId={previewAnchorPointerEdit?.anchor.id ?? null}
                    previewCueEditingId={previewCuePointerEdit?.cue.id ?? null}
                    previewScrollEditingId={previewScrollPointerEdit?.eventId ?? null}
                    scrollEvents={stageScrollEvents}
                    selectedId={selectedId}
                    selectedPreviewCanvasId={resolvedPreviewCanvasId}
                    visualCutEditingId={visualCutPointerEdit?.clipId ?? null}
                    visualClips={editableVisualClips}
                />
                <InspectorPanel
                    activeVisual={activeVisual}
                    anchors={anchors}
                    anchorEventDraft={anchorEventDraft}
                    characterById={characterById}
                    cueScriptState={cueScriptState}
                    effects={selectedEffects}
                    onAnchorEventDraftChange={handleAnchorEventDraftChange}
                    onDeleteAnchor={handleDeleteAnchor}
                    onDeleteAnchorEvent={handleDeleteAnchorEvent}
                    onCueScriptDraftChange={setCueScriptDraft}
                    onSaveCueScript={handleSaveCueScript}
                    onSaveAnchorEvent={handleSaveAnchorEvent}
                    onDeleteTimelineItem={handleDeleteTimelineItem}
                    onNudgeScrollPosition={handleNudgeScrollPosition}
                    onStepTimelineItem={handleStepTimelineItem}
                    onUpdateVideoClipControls={handleUpdateVideoClipControls}
                    onResizeStart={handleStartInspectorResize}
                    previewStripHeightPx={previewStripHeightPx}
                    previewVisualSegments={previewVisualSegments}
                    selectedItem={selectedItem}
                    trackById={audioTrackById}
                />
                <Timeline
                    anchors={anchors}
                    audioTracks={timelineData.audioTracks}
                    characterById={characterById}
                    draggingItemId={timelinePointerEdit?.itemId ?? null}
                    durationSeconds={timelineDurationSeconds}
                    effectsById={effectsById}
                    focusedTrackId={focusedTrackId}
                    isSnapEnabled={isSnapEnabled}
                    isTimelineHeightResizing={timelinePanelResize !== null}
                    isTimelineSidebarResizing={timelineSidebarResize !== null}
                    lockedTrackIds={lockedTrackIds}
                    mutedTrackIds={mutedTrackIds}
                    onAddCue={handleAddCue}
                    onCloseTrackContextMenu={handleCloseTrackContextMenu}
                    onDeleteTrack={handleDeleteTrack}
                    onFocusTrack={handleFocusTrack}
                    onDropAudioOnTrack={handleDropAudioOnTrack}
                    onOpenTrackContextMenu={handleOpenTrackContextMenu}
                    onOpenTrackModal={handleOpenTrackModal}
                    onScrub={handleScrub}
                    onSelectAnchor={handleSelectAnchor}
                    onSelect={handleSelectItem}
                    onSelectTimelineRange={handleSelectTimelineRange}
                    onSplitTimelineItem={handleSplitTimelineItem}
                    onTimelineHeightResizeStart={handleStartTimelineHeightResize}
                    onTimelineSidebarResizeStart={handleStartTimelineSidebarResize}
                    onTimelineAnchorEditEnd={handleEndTimelineAnchorEdit}
                    onTimelineAnchorEditMove={handleMoveTimelineAnchorEdit}
                    onTimelineAnchorEditStart={handleStartTimelineAnchorEdit}
                    onTimelinePointerEditEnd={handleEndTimelinePointerEdit}
                    onTimelinePointerEditMove={handleMoveTimelinePointerEdit}
                    onTimelinePointerEditStart={handleStartTimelinePointerEdit}
                    onTimelineToolChange={handleTimelineToolChange}
                    onTimelineZoomChange={(nextPxPerSecond) => setPxPerSecond(clamp(nextPxPerSecond, MIN_PX_PER_SECOND, MAX_PX_PER_SECOND))}
                    onTimelineZoomStep={(delta) => setPxPerSecond((current) => clamp(current + delta, MIN_PX_PER_SECOND, MAX_PX_PER_SECOND))}
                    onToggleTrackLock={handleToggleTrackLock}
                    onToggleTrackMute={handleToggleTrackMute}
                    onToggleTrackSolo={handleToggleTrackSolo}
                    onToggleSnap={() => setIsSnapEnabled((current) => !current)}
                    playhead={playhead}
                    pxPerSecond={pxPerSecond}
                    rangeSelectionIds={rangeSelectionIds}
                    scrollEvents={scrollEvents}
                    selectedId={selectedId}
                    soloTrackIds={soloTrackIds}
                    trackLoadError={trackLoadError}
                    trackContextMenu={trackContextMenu}
                    timelineAnchorEditingId={timelineAnchorPointerEdit?.anchor.id ?? null}
                    timelineTool={timelineTool}
                    timelineHeight={timelineHeight}
                    timelineSidebarWidth={timelineSidebarWidth}
                    timelineClips={timelineData.timelineClips}
                    videoClips={videoTimelineClips}
                    deletingTrackId={deletingTrackId}
                />
            </main>
            {isTrackModalOpen ? (
                <div className="odx-track-modal-overlay" role="presentation" onClick={handleCloseTrackModal}>
                    <form
                        className="odx-track-modal"
                        onClick={(event) => event.stopPropagation()}
                        onSubmit={(event) => {
                            event.preventDefault();
                            void handleAddTrack();
                        }}
                    >
                        <div className="odx-track-modal-head">
                            <span>새 트랙 추가</span>
                            <button
                                aria-label="닫기"
                                className="odx-icon-btn"
                                disabled={isCreatingTrack}
                                onClick={handleCloseTrackModal}
                                type="button"
                            >
                                <StudioIcon name="minus" size={15} />
                            </button>
                        </div>
                        <label className="odx-track-modal-field">
                            <span>트랙 유형</span>
                            <select
                                disabled={isCreatingTrack}
                                value={newTrackType}
                                onChange={(event) => {
                                    const nextTrackType = event.target.value as TrackFormType;

                                    setNewTrackType(nextTrackType);
                                    setTrackModalError(null);
                                    if (nextTrackType !== 'record') {
                                        setNewTrackCharacterId('');
                                    }
                                }}
                            >
                                <option value="record">캐릭터 보이스</option>
                                <option value="audio">내레이션 / 오디오</option>
                                <option value="bgm">BGM</option>
                                <option value="effect">SFX / 효과음</option>
                                <option value="scroll">스크롤 트랙</option>
                            </select>
                        </label>
                        {newTrackType === 'record' ? (
                            <label className="odx-track-modal-field">
                                <span>캐릭터</span>
                                <select
                                    disabled={isCreatingTrack || characters.length === 0}
                                    value={newTrackCharacterId}
                                    onChange={(event) => {
                                        setNewTrackCharacterId(event.target.value);
                                        setTrackModalError(null);
                                    }}
                                    required
                                >
                                    <option value="">캐릭터 선택</option>
                                    {characters.map((character) => (
                                        <option key={character.id} value={character.id}>
                                            {character.name} · {character.role}
                                        </option>
                                    ))}
                                </select>
                                <small className="odx-track-modal-help">
                                    {characters.length > 0
                                        ? '캐릭터를 선택해야 보이스 트랙을 생성할 수 있습니다.'
                                        : '이 작품에 등록된 캐릭터가 없습니다.'}
                                </small>
                            </label>
                        ) : null}
                        <label className="odx-track-modal-field">
                            <span>트랙 이름</span>
                            <input
                                autoFocus
                                disabled={isCreatingTrack}
                                onChange={(event) => setNewTrackName(event.target.value)}
                                placeholder={
                                    newTrackType === 'record' ? '비워두면 캐릭터 이름으로 생성됩니다.' : '예: 회상 BGM'
                                }
                                value={newTrackName}
                            />
                        </label>
                        {trackModalError ? (
                            <p className="odx-track-modal-error" role="alert">
                                {trackModalError}
                            </p>
                        ) : null}
                        <div className="odx-track-modal-actions">
                            <button
                                className="odx-modal-sub"
                                disabled={isCreatingTrack}
                                onClick={handleCloseTrackModal}
                                type="button"
                            >
                                취소
                            </button>
                            <button className="odx-modal-apply" disabled={!canCreateTrack} type="submit">
                                {isCreatingTrack ? '추가 중' : '트랙 추가'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
