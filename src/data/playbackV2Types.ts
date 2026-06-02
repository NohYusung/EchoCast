import type {
  VogopangContentAudioTrack,
  VogopangContentImage,
  VogopangContentInlineMedia,
  VogopangContentTrack,
} from "@/data/vogopangContentTypes";

export type PlaybackCueType = "voice" | "sfx" | "music";
export type BeatDurationPolicy = "autoByVoice" | "fixed" | "manual";
export type CameraEasing = "linear" | "easeInOut" | "hold";
export type PlaybackVoiceAssetMode = "perLine" | "characterMerged";

export interface PlaybackV2Envelope {
  schemaVersion: "playback-v2.beat.mock.1";
  playerKey: string;
  title?: string;
  authoringDocument: StoryAuthoringDocument;
  playbackManifest: PlaybackManifest;
  compatibility: {
    migratedFrom: "vogopang-content";
    legacyFormatVersion: string;
  };
}

export interface StoryAuthoringDocument {
  schemaVersion: "story-authoring.beat.mock.1";
  id: string;
  title?: string;
  storyStrip: StoryStrip;
  scenes: StoryScene[];
  beats: StoryBeat[];
  assets: AuthoringAssetCatalog;
}

export interface StoryStrip {
  coordinate: "vertical-units";
  panels: StoryPanel[];
  items: StoryStripItem[];
  replaceImages: unknown[];
  /** Deprecated compatibility fields. New authoring code must use panels/items. */
  images?: VogopangContentImage[];
  inlineMedia?: VogopangContentInlineMedia[];
}

export interface StoryPanel {
  id: string;
  order: number;
  source: VogopangContentImage;
  layout: {
    topUnits: number;
    heightUnits: number;
    aspectRatio: "2 / 3";
  };
}

export type StoryStripItem = StoryStripImageItem | StoryStripVideoItem;

export interface StoryStripImageItem {
  id: string;
  type: "image";
  panelId: string;
  order: number;
  source: VogopangContentImage;
  layout: {
    heightUnits: number;
    aspectRatio: "2 / 3";
  };
}

export interface StoryStripVideoItem {
  id: string;
  type: "video";
  order: number;
  source: {
    provider: "youtube";
    src: string;
    embedUrl: string;
    title?: string;
  };
  embedUrl: string;
  placement: {
    afterImageOrder: number;
    anchorImageOrder: number;
    offsetRatio: number;
  };
  layout: {
    heightUnits: number;
    aspectRatio: string;
  };
  metadata?: {
    afterScriptLineId?: string;
    beforeScriptLineId?: string;
  };
}

export interface ContentAnchor {
  panelId: string;
  ratioY: number;
}

export interface StoryScene {
  id: string;
  title: string;
  beatIds: string[];
}

export interface StoryBeat {
  id: string;
  sceneId: string;
  order: number;
  anchor: ContentAnchor;
  durationPolicy: BeatDurationPolicy;
  minDurationMs: number;
  maxDurationMs?: number;
  voiceLines: VoiceLine[];
  soundEffects: SoundCue[];
  screenEffects: AuthoringVisualCue[];
  cameraIntent: CameraIntent;
}

export interface CameraIntent {
  movement: "moveTo" | "hold";
  target: ContentAnchor;
  easing: CameraEasing;
  holdBeforeMs: number;
  holdAfterMs: number;
}

export interface VoiceLine {
  id: string;
  characterId: string;
  characterName: string;
  scriptLineId: string;
  text: string;
  assetId: string;
  source: {
    src: string;
    artistNo?: number;
    effects?: unknown;
  };
  sourceDurationMs: number;
  trimLeftMs: number;
  trimRightMs: number;
  volume: number;
}

export interface SoundCue {
  id: string;
  trackId: string;
  assetId: string;
  source: {
    src: string;
  };
  relativeOffsetMs: number;
  sourceDurationMs: number;
  trimLeftMs: number;
  trimRightMs: number;
  volume: number;
  effects?: unknown;
}

export interface AuthoringVisualCue {
  id: string;
  type: "effect" | "inline-media";
  relativeOffsetMs: number;
  durationMs: number;
  sourceRef: {
    kind: "effect" | "inline-media";
    id: string;
  };
  params?: unknown;
}

export interface AuthoringAssetCatalog {
  images: VogopangContentImage[];
  audio: Array<{
    id: string;
    type: PlaybackCueType;
    src: string;
  }>;
  inlineMedia: Array<{
    id: string;
    provider: "youtube";
    src: string;
    embedUrl: string;
  }>;
}

export interface PlaybackManifest {
  schemaVersion: "playback-manifest.beat.mock.1";
  id: string;
  sourceDocumentId: string;
  cameraPath: PlaybackCameraPath;
  audioCues: PlaybackAudioCue[];
  visualCues: PlaybackVisualCue[];
  assetManifest: PlaybackAssetManifest;
  durationMs: number;
}

export interface PlaybackCameraPath {
  coordinate: "viewportY" | "positionRatio" | "top";
  totalHeightUnits?: number;
  segments: PlaybackCameraSegment[];
  keyframes: PlaybackCameraKeyframe[];
}

export interface PlaybackCameraSegment {
  startBeatId: string;
  endBeatId: string;
  startMs: number;
  endMs: number;
  fromY: number;
  toY: number;
  holdBeforeMs: number;
  holdAfterMs: number;
  easing: CameraEasing;
}

export interface PlaybackCameraKeyframe {
  id: string;
  beatId?: string;
  timeMs: number;
  viewportY?: number;
  positionRatio?: number;
  top?: number;
  holdBeforeMs: number;
  holdAfterMs: number;
}

export interface PlaybackAudioCue {
  id: string;
  type: PlaybackCueType;
  beatId?: string;
  assetId: string;
  trackId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  sourceStartMs: number;
  sourceEndMs: number;
  trimLeftMs: number;
  trimRightMs: number;
  volume: number;
  sourceRef: {
    kind: "voice-line" | "sound-cue" | "music-cue";
    id: string;
  };
  sources: Array<{
    src: string;
    artistNo?: number;
  }>;
  effects?: unknown;
}

export interface PlaybackVisualCue {
  id: string;
  type: "effect" | "inline-media";
  beatId?: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  sourceRef?: {
    kind: "effect" | "inline-media";
    id: string;
  };
  params?: unknown;
}

export interface PlaybackAssetManifest {
  images: VogopangContentImage[];
  audio: PlaybackAudioAsset[];
  inlineMedia: Array<{
    id: string;
    provider: "youtube";
    src: string;
    embedUrl: string;
  }>;
}

export interface PlaybackAudioAsset {
  id: string;
  type: PlaybackCueType;
  src: string;
  trackId?: string;
  sourceMode?: "singleSource" | "characterMerged";
  sourceLineIds?: string[];
  durationMs?: number;
}

export interface PlaybackTimelineIndex {
  cameraPath: IndexedCameraPath;
  audioCues: PlaybackAudioCue[];
  visualCues: PlaybackVisualCue[];
}

export interface IndexedCameraPath {
  coordinate: PlaybackCameraPath["coordinate"];
  totalHeightUnits?: number;
  segments: PlaybackCameraSegment[];
  keyframes: PlaybackCameraKeyframe[];
}

export interface CameraPathSampleMetrics {
  scrollHeight: number;
  viewportHeight: number;
  currentScrollTop: number;
}

export interface AudioCueScheduleItem {
  cue: PlaybackAudioCue;
  delayMs: number;
  offsetMs: number;
  playDurationMs: number;
}

export type LegacyVogopangAuthoringSource = {
  tracks?: VogopangContentTrack[];
  audioTracks?: VogopangContentAudioTrack[];
};
