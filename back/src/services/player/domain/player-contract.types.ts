export type TrackKind = "visual" | "dialogue" | "audio" | "effect";
export type TimelineItemKind = "visual" | "audio" | "effect" | "cue";
export type MediaKind = "image" | "video" | "audio" | "effect";
export type RecordStatus = "draft" | "approved" | "rejected";

export interface ProductDraft {
  id: string;
  title: string;
  coverImageUrl?: string;
}

export interface EpisodeDraft {
  id: string;
  productId: string;
  episodeNumber: number;
  title: string;
  subTitle?: string;
}

export interface CharacterDraft {
  id: string;
  name: string;
  color: string;
  defaultTtsVoiceId?: string;
}

export interface ScriptDraft {
  id: string;
  episodeId: string;
  characterId: string;
  text: string;
  sortOrder: number;
}

export interface TrackDraft {
  id: string;
  episodeId: string;
  name: string;
  kind: TrackKind;
  layerId: number;
  isMuted: boolean;
}

export interface TimelineItemDraft {
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
  volume?: number;
}

export interface MediaDraft {
  id: string;
  episodeId: string;
  kind: MediaKind;
  url: string;
  naturalWidth?: number;
  naturalHeight?: number;
  durationMs?: number;
}

export interface TtsVoiceDraft {
  id: string;
  provider: string;
  voiceName: string;
  languageCode: string;
}

export interface CueDraft {
  id: string;
  episodeId: string;
  scriptId: string;
  characterId: string;
  trackId: string;
  startTime: number;
  endTime: number;
  ttsVoiceId?: string;
  ttsUrl?: string;
  volume: number;
}

export interface RecordDraft {
  id: string;
  cueId: string;
  artistId: string;
  status: RecordStatus;
  audioUrl: string;
  durationMs: number;
  volume: number;
}

export interface ScreenEffectDraft {
  uuid: string;
  time_ms: number;
  params: Record<string, unknown>;
}

export interface PlayerDraft {
  products: ProductDraft[];
  episodes: EpisodeDraft[];
  characters: CharacterDraft[];
  scripts: ScriptDraft[];
  tracks: TrackDraft[];
  timelineItems: TimelineItemDraft[];
  media: MediaDraft[];
  ttsVoices: TtsVoiceDraft[];
  cues: CueDraft[];
  records: RecordDraft[];
  screenEffects?: ScreenEffectDraft[];
}
