import type { PlayerManifest } from "./playerManifest.types";

export type PlaybackEventKind = "record" | "tts";

export interface PlaybackEvent {
  id: string;
  cueId: string;
  kind: PlaybackEventKind;
  sourceId: string;
  url: string;
  startTime: number;
  endTime: number;
  volume: number;
}

export function buildPlaybackEvents(manifest: PlayerManifest): PlaybackEvent[] {
  const approvedRecordByCueId = new Map(
    manifest.records
      .filter((record) => record.status === "approved")
      .map((record) => [record.cueId, record]),
  );
  const ttsByCueId = new Map(manifest.tts.map((tts) => [tts.cueId, tts]));

  return manifest.cues
    .flatMap((cue): PlaybackEvent[] => {
      const approvedRecord = approvedRecordByCueId.get(cue.id);
      if (approvedRecord) {
        return [
          {
            id: `record-event-${approvedRecord.id}`,
            cueId: cue.id,
            kind: "record",
            sourceId: approvedRecord.id,
            url: approvedRecord.audioUrl,
            startTime: cue.startTime,
            endTime: cue.startTime + approvedRecord.durationMs,
            volume: approvedRecord.volume * cue.volume,
          },
        ];
      }

      const tts = ttsByCueId.get(cue.id);
      if (!tts) return [];

      return [
        {
          id: `tts-event-${tts.id}`,
          cueId: cue.id,
          kind: "tts",
          sourceId: tts.id,
          url: tts.audioUrl,
          startTime: cue.startTime,
          endTime: cue.endTime,
          volume: cue.volume,
        },
      ];
    })
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
}
