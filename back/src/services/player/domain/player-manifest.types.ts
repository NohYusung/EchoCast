import type {
  MediaKind,
  TimelineItemKind,
  TrackKind,
} from "./player-contract.types";

export interface TimelineTrackManifest {
  id: string;
  name: string;
  kind: TrackKind;
  layerId: number;
  isMuted: boolean;
}

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

export interface MediaManifest {
  id: string;
  kind: MediaKind;
  url: string;
  naturalWidth?: number;
  naturalHeight?: number;
  durationMs?: number;
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
  status: "draft" | "approved" | "rejected";
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
  tracks: TimelineTrackManifest[];
  items: TimelineItemManifest[];
  cues: CueManifest[];
  media: MediaManifest[];
  records: RecordManifest[];
  tts: TtsManifest[];
}
