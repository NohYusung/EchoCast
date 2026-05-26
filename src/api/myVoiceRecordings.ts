export const MY_VOICE_SLOT_MAX = 30;

export interface MyVoiceRecordingListItem {
  episodeId?: number;
  recordingIds?: number[];
}

export async function getMyVoiceRecordingList(): Promise<{
  items: MyVoiceRecordingListItem[];
  slotMax: number;
}> {
  return { items: [], slotMax: MY_VOICE_SLOT_MAX };
}
