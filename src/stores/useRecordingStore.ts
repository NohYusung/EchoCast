import { create } from 'zustand';
import { playerLogger } from '@/app/player/_lib/playerLogger';
import * as RecordingStorage from '@/app/player/_lib/recordingStorage';
import { RecordingData } from '@/app/player/_lib/recordingStorage';
import {
  canBrowserPlayRecordingMimeType,
  inferEpisodeRecordingMimeType,
  isUsableRecordingSrc,
  resolveEpisodeRecordingAudioUrl,
} from '@/api/episodeRecordings';

export interface HoleInfo {
  uuid: string; // holeUuid
  script: string;
  start_ms: number;
  duration_ms: number;
  characterName: string;
}

interface RecordingStore {
  isOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;

  isRecordingMode: boolean;
  enterRecordingMode: () => void;
  exitRecordingMode: () => void;

  expandedHoleUuid: string | null;
  setExpandedHoleUuid: (holeUuid: string | null) => void;

  recordings: RecordingData[];
  initialRecordings: RecordingData[];
  setRecordings: (recordings: RecordingData[]) => void;

  loadRecordings: (episodeId: number, site?: string) => void;
  saveRecording: (episodeId: number, recordingData: RecordingData, site?: string) => boolean;
  removeRecording: (episodeId: number, holeUuid: string, site?: string) => boolean;
  setRecordingApply: (
    episodeId: number,
    holeUuid: string,
    isApply: boolean,
    site?: string
  ) => boolean;

  hasHoleRecording: (holeUuid: string) => boolean;
  isApplyRecording: (holeUuid: string) => boolean;
  getRecording: (holeUuid: string) => RecordingData | null;

  useUserRecording: boolean;
  setUseUserRecording: (enabled: boolean) => void;

  /** 서버에서 내려준 녹음 URL (hole.uuid 기준). 로컬 스토리지에는 저장하지 않음 */
  serverRecordingsByHoleUuid: Record<string, { src: string }>;
  /** `GET /holes` item.id — `POST /recordings`의 holeId */
  serverHoleIdByHoleUuid: Record<string, number>;
  setServerRecordings: (
    map: Record<string, { src: string }>,
    holeIds?: Record<string, number>,
  ) => void;
  hasAnyUsableServerRecording: () => boolean;

  getAppliedRecordings: () => RecordingData[];
  hasRecordingChanges: () => boolean;

  cleanup: () => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  isOpen: false,
  openDialog: () => set({ isOpen: true }),
  closeDialog: () => set({ isOpen: false, expandedHoleUuid: null }),

  isRecordingMode: false,
  enterRecordingMode: () => set({ isRecordingMode: true, isOpen: true }),
  exitRecordingMode: () => set({ isRecordingMode: false, isOpen: false, expandedHoleUuid: null }),

  expandedHoleUuid: null,
  setExpandedHoleUuid: (holeUuid) => set({ expandedHoleUuid: holeUuid }),

  recordings: [],
  initialRecordings: [],
  setRecordings: (recordings) => set({ recordings }),

  loadRecordings: (episodeId: number, site?: string) => {
    if (episodeId == null) {
      playerLogger.warn('[useRecordingStore] loadRecordings: episodeId is not set');
      return;
    }
    const storageKey = site != null ? `${site}_${episodeId}` : String(episodeId);
    const recordings = RecordingStorage.loadRecordings(storageKey);
    set({ recordings: recordings ?? [], initialRecordings: recordings ?? [] });
  },

  saveRecording: (episodeId: number, recordingData: RecordingData, site?: string) => {
    const { recordings } = get();
    if (episodeId == null) return false;
    const filteredRecordings = recordings.filter((r) => r.holeUuid !== recordingData.holeUuid);
    const newRecordings = [...filteredRecordings, recordingData];
    set({ recordings: newRecordings });
    const storageKey = site != null ? `${site}_${episodeId}` : String(episodeId);
    return RecordingStorage.saveRecordings(storageKey, newRecordings);
  },

  removeRecording: (episodeId: number, holeUuid: string, site?: string) => {
    const { recordings } = get();
    if (episodeId == null) return false;
    const newRecordings = recordings.filter((r) => r.holeUuid !== holeUuid);
    set({ recordings: newRecordings });
    const storageKey = site != null ? `${site}_${episodeId}` : String(episodeId);
    return RecordingStorage.saveRecordings(storageKey, newRecordings);
  },

  setRecordingApply: (episodeId: number, holeUuid: string, isApply: boolean, site?: string) => {
    const { recordings } = get();
    if (episodeId == null) return false;

    const newRecordings = recordings.map((recording) =>
      recording.holeUuid === holeUuid ? { ...recording, isApply } : recording
    );

    set({ recordings: newRecordings });
    const storageKey = site != null ? `${site}_${episodeId}` : String(episodeId);
    return RecordingStorage.saveRecordings(storageKey, newRecordings);
  },

  hasHoleRecording: (holeUuid: string) => {
    if (get().recordings.some((r) => r.holeUuid === holeUuid)) return true;
    return isUsableRecordingSrc(get().serverRecordingsByHoleUuid[holeUuid]?.src);
  },
  isApplyRecording: (holeUuid: string) => {
    const rec = get().recordings.find((r) => r.holeUuid === holeUuid);
    if (rec) return rec.isApply ?? false;
    return isUsableRecordingSrc(get().serverRecordingsByHoleUuid[holeUuid]?.src);
  },
  getRecording: (holeUuid: string) => {
    const local = get().recordings.find((r) => r.holeUuid === holeUuid);
    if (local) return local;
    const srv = get().serverRecordingsByHoleUuid[holeUuid];
    if (!isUsableRecordingSrc(srv?.src)) return null;
    const blobUrl = resolveEpisodeRecordingAudioUrl(srv!.src);
    if (!blobUrl) return null;
    const mimeType = inferEpisodeRecordingMimeType(srv!.src);
    if (!canBrowserPlayRecordingMimeType(mimeType)) return null;
    return {
      holeUuid,
      blobUrl,
      blobData: '',
      mimeType,
      recordedAt: 0,
      durationMs: 0,
      isApply: true,
    };
  },

  useUserRecording: false,
  setUseUserRecording: (enabled: boolean) => {
    playerLogger.log('[useRecordingStore] setUseUserRecording:', enabled);
    set({ useUserRecording: enabled });
  },

  serverRecordingsByHoleUuid: {},
  serverHoleIdByHoleUuid: {},
  setServerRecordings: (map, holeIds = {}) =>
    set({ serverRecordingsByHoleUuid: map, serverHoleIdByHoleUuid: holeIds }),
  hasAnyUsableServerRecording: () => {
    const m = get().serverRecordingsByHoleUuid;
    return Object.values(m).some((v) => {
      if (!isUsableRecordingSrc(v?.src)) return false;
      return canBrowserPlayRecordingMimeType(inferEpisodeRecordingMimeType(v?.src));
    });
  },

  // pudding과 동일: '녹음 적용' ON이면 저장된 녹음 전부 재생에 사용 (개별 ON은 hasRecording만 표시, isApply 미저장이므로)
  getAppliedRecordings: () => get().recordings.filter((recording) => recording.isApply),
  hasRecordingChanges: () => {
    const { recordings, initialRecordings } = get();
    if (recordings.length !== initialRecordings.length) {
      return true;
    }

    const normalize = (items: RecordingData[]) =>
      [...items]
        .map((item) => ({
          holeUuid: item.holeUuid,
          blobData: item.blobData,
          mimeType: item.mimeType,
          recordedAt: item.recordedAt,
          durationMs: item.durationMs,
          isApply: item.isApply,
        }))
        .sort((a, b) => a.holeUuid.localeCompare(b.holeUuid));

    return JSON.stringify(normalize(recordings)) !== JSON.stringify(normalize(initialRecordings));
  },

  cleanup: () => set({ expandedHoleUuid: null }),

  reset: () => {
    playerLogger.log('[useRecordingStore] reset');
    set({
      isOpen: false,
      isRecordingMode: false,
      recordings: [],
      initialRecordings: [],
      expandedHoleUuid: null,
      useUserRecording: false,
      serverRecordingsByHoleUuid: {},
      serverHoleIdByHoleUuid: {},
    });
  },
}));
