/* eslint-disable @typescript-eslint/no-explicit-any */
/*
    recordingStorage.ts
    Local storage management for voice recordings
    Stores recordings by hole UUID with blob data
    Author: AI Assistant
    Last update: 2025-01-21
*/

const STORAGE_KEY_PREFIX = 'pudding_recording_';

export interface RecordingData {
  holeUuid: string;
  blobUrl: string;
  blobData: string; // Base64 encoded blob data
  mimeType: string;
  recordedAt: number; // timestamp
  durationMs: number;
  isApply: boolean;
}

/**
 * Convert Blob to Base64 string
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert Base64 string to Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Generate storage key for a hole UUID
 */
function getStorageKey(key: string): string {
  return `${STORAGE_KEY_PREFIX}${key}`;
}

/**
 * Save recording to localStorage
 */
export function saveRecordings(key: string, recordss: RecordingData[]): boolean {
  try {
    const data = JSON.stringify(recordss);
    const storageKey = getStorageKey(key);
    localStorage.setItem(storageKey, data);
    console.log('[recordingStorage] Success saving recordings');
    console.log(recordss);
    return true;
  } catch (e) {
    console.error('[recordingStorage] Error saving recordings:', e);
    return false;
  }
}

/**
 * Load recording from localStorage
 */
export function loadRecordings(key: string): RecordingData[] | null {
  try {
    const storageKey = getStorageKey(key);
    const dataStr = localStorage.getItem(storageKey);

    if (!dataStr) {
      return null;
    }

    const datas: any[] = JSON.parse(dataStr) || [];
    const records = datas.map(data => {
      const record = data as Omit<RecordingData, 'blobUrl'>;
      const blob = base64ToBlob(record.blobData, record.mimeType);
      const blobUrl = URL.createObjectURL(blob);
      return {
        ...data,
        blobUrl
      };
    });
    console.log('[recordingStorage] Success loading recordings');
    console.log(records);
    return records;
  } catch (e) {
    console.error('[recordingStorage] Error loading recordings:', e);
    return null;
  }
}

/**
 * Delete recording from localStorage
 */
export function deleteRecordings(key: string): boolean {
  try {
    const storageKey = getStorageKey(key);
    localStorage.removeItem(storageKey);
    console.log('[recordingStorage] Success deleting recordings');
    return true;
  } catch (e) {
    console.error('[recordingStorage] Error deleting recordings:', e);
    return false;
  }
}

/**
 * `useRecordingStore.loadRecordings(episodeId, site)`와 동일한 키로 해당 에피소드 로컬 녹음을 전부 삭제한다.
 * (마이 보이스에서 서버 녹음만 지울 때 로컬이 남아 같은 단말에서만 구버전이 보이는 문제 방지)
 */
export function deleteRecordingsForEpisode(episodeId: number, site?: string): boolean {
  if (episodeId == null || !Number.isFinite(episodeId) || episodeId <= 0) {
    return false;
  }
  const storageKey = site != null ? `${site}_${episodeId}` : String(episodeId);
  return deleteRecordings(storageKey);
}

/**
 * Create recording
 */
export async function createRecordingData(holeUuid: string,
                                       blob: Blob,
                                       durationMs: number = 0,
                                       isApply: boolean = false): Promise<RecordingData | null> {
  try {
    console.log('[recordingStorage] Saving recording for hole:', holeUuid);
    const base64Data = await blobToBase64(blob);
    const recordingData: Omit<RecordingData, 'blobUrl'> = {
      holeUuid,
      blobData: base64Data,
      mimeType: blob.type || 'audio/webm',
      recordedAt: Date.now(),
      durationMs,
      isApply
    };
    return recordingData as RecordingData;
  } catch (e) {
    console.error('[recordingStorage] Error saving recording:', e);
    return null;
  }
}
