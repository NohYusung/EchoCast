import type {
  PlaybackManifest,
  StoryAuthoringDocument,
} from "@/data/playbackV2Types";

/**
 * 플레이어 콘텐츠 JSON 구조 타입 (각 사이트 player/_json/*.json)
 *
 * series/episode/캐스팅 없음. 이 JSON만 있으면 플레이어 재생 가능.
 * API에서는 MessagePack 인코딩으로 전달하고, 플레이어에서 디코딩해 사용.
 */

export interface VogopangContentImage {
  uuid: string;
  realname: string;
  order: number;
  src: string;
}

export interface VogopangContentSpoint {
  uuid: string;
  id?: number;
  roundId?: number;
  index?: number;
  top: number;
  time_ms: number;
  startMs?: number;
  transition_effect: { before_ms: number; after_ms: number };
  positionRatio?: number;
}

/** hole 내 record (보이스/오디오 한 건) */
export interface VogopangContentRecord {
  src: string;
  artist_no: number;
  effects?: {
    eq?: { gain_values?: number[] };
    delay?: { delay?: number; feedback?: number };
    reverb?: { decay?: number; preDelay?: number };
    pitch_shift?: number;
    chorus?: { frequency?: number; depth?: number; delayTime?: number };
    gain?: { value?: number };
  };
  margin?: number;
}

/** track 내 hole (대사/보이스 한 구간) */
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

/** 오디오 트랙 내 clip 구조 */
export interface VogopangContentAudioClip {
  uuid?: string;
  src?: string;
  url?: string;
  rawSrc?: string;
  start_ms?: number;
  duration_ms?: number;
  trim_left_ms?: number;
  trim_right_ms?: number;
  effects?: VogopangContentRecord["effects"];
  [key: string]: unknown;
}

/** 오디오 트랙 (배경음악 등) */
export interface VogopangContentAudioTrack {
  uuid?: string;
  clips?: VogopangContentAudioClip[];
  [key: string]: unknown;
}

export interface VogopangContentInlineMedia {
  type: "youtube";
  mode: "inline";
  src: string;
  embedUrl?: string;
  after_image_order: number;
  start_ms?: number;
  duration_ms?: number;
  startMs?: number;
  durationMs?: number;
  after_script_uuid?: string;
  before_script_uuid?: string;
  aspect_ratio?: string;
  render_image_order?: number;
  render_image_offset_ratio?: number;
  title?: string;
}

/** 플레이어 콘텐츠 JSON 루트 구조 */
export interface VogopangContent {
  images: VogopangContentImage[];
  replace_images: unknown[];
  format_version: string;
  spoints: VogopangContentSpoint[];
  tracks: VogopangContentTrack[];
  audio_tracks?: VogopangContentAudioTrack[];
  inline_media?: VogopangContentInlineMedia[];
  playback_manifest?: PlaybackManifest;
  authoring_document?: StoryAuthoringDocument;
}

export interface PlaybackV2RuntimeContent {
  format_version: "V2";
  replace_images: unknown[];
  playback_manifest: PlaybackManifest;
  authoring_document: StoryAuthoringDocument;
  images?: never;
  spoints?: never;
  tracks?: never;
  audio_tracks?: never;
  inline_media?: never;
}

export type PlayerRuntimeContent = VogopangContent | PlaybackV2RuntimeContent;
