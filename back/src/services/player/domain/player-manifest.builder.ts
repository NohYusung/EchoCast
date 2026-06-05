import type { PlayerDraft } from "./player-contract.types";
import type {
  PlayerManifest,
  RecordManifest,
  TtsManifest,
} from "./player-manifest.types";

const forbiddenLegacyFields = new Set([
  "spoints",
  "spoint",
  "positionRatio",
  "top",
]);

export function buildPlayerManifest(draft: PlayerDraft): PlayerManifest {
  const trackIds = new Set(draft.tracks.map((track) => track.id));
  const mediaIds = new Set(draft.media.map((media) => media.id));
  const cueIds = new Set(draft.cues.map((cue) => cue.id));
  const scriptIds = new Set(draft.scripts.map((script) => script.id));
  const characterIds = new Set(
    draft.characters.map((character) => character.id),
  );
  const ttsVoicesById = new Map(
    draft.ttsVoices.map((voice) => [voice.id, voice]),
  );

  for (const item of draft.timelineItems) {
    if (item.endTime <= item.startTime) {
      throw new Error(`timeline item ${item.id} must end after it starts`);
    }

    if (!trackIds.has(item.trackId)) {
      throw new Error(
        `timeline item ${item.id} references missing track ${item.trackId}`,
      );
    }

    if (item.mediaId && !mediaIds.has(item.mediaId)) {
      throw new Error(
        `timeline item ${item.id} references missing media ${item.mediaId}`,
      );
    }

    if (item.cueId && !cueIds.has(item.cueId)) {
      throw new Error(
        `timeline item ${item.id} references missing cue ${item.cueId}`,
      );
    }
  }

  const records = draft.records.map((record): RecordManifest => ({ ...record }));
  const approvedRecordByCueId = new Map(
    records
      .filter((record) => record.status === "approved")
      .map((record) => [record.cueId, record]),
  );

  const cues = draft.cues.map((cue) => {
    if (cue.endTime <= cue.startTime) {
      throw new Error(`cue ${cue.id} must end after it starts`);
    }

    if (!scriptIds.has(cue.scriptId)) {
      throw new Error(`cue ${cue.id} references missing script ${cue.scriptId}`);
    }

    if (!characterIds.has(cue.characterId)) {
      throw new Error(
        `cue ${cue.id} references missing character ${cue.characterId}`,
      );
    }

    if (!trackIds.has(cue.trackId)) {
      throw new Error(`cue ${cue.id} references missing track ${cue.trackId}`);
    }

    return {
      id: cue.id,
      scriptId: cue.scriptId,
      characterId: cue.characterId,
      trackId: cue.trackId,
      startTime: cue.startTime,
      endTime: cue.endTime,
      approvedRecordUrl: approvedRecordByCueId.get(cue.id)?.audioUrl,
      ttsUrl: cue.ttsUrl,
      volume: cue.volume,
    };
  });

  const tts = draft.cues.flatMap((cue): TtsManifest[] => {
    if (!cue.ttsVoiceId || !cue.ttsUrl) return [];

    const voice = ttsVoicesById.get(cue.ttsVoiceId);
    if (!voice) {
      throw new Error(
        `cue ${cue.id} references missing tts voice ${cue.ttsVoiceId}`,
      );
    }

    return [
      {
        id: `tts-${cue.id.replace(/^cue-/, "")}`,
        cueId: cue.id,
        voiceId: voice.id,
        provider: voice.provider,
        voiceName: voice.voiceName,
        audioUrl: cue.ttsUrl,
      },
    ];
  });

  const items = draft.timelineItems
    .map((item) => ({
      id: item.id,
      trackId: item.trackId,
      kind: item.kind,
      startTime: item.startTime,
      endTime: item.endTime,
      mediaId: item.mediaId,
      cueId: item.cueId,
      layerId: item.layerId,
      trimStartTime: item.trimStartTime,
      trimEndTime: item.trimEndTime,
      volume: item.volume ?? 1,
    }))
    .sort((a, b) => a.startTime - b.startTime || a.layerId - b.layerId);

  const durationMs = Math.max(
    0,
    ...items.map((item) => item.endTime),
    ...cues.map((cue) => cue.endTime),
    ...records.map((record) => {
      const cue = draft.cues.find((candidate) => candidate.id === record.cueId);
      return cue ? cue.startTime + record.durationMs : 0;
    }),
  );

  const manifest: PlayerManifest = {
    episodeId: draft.episodes[0]?.id ?? "unknown",
    durationMs,
    tracks: draft.tracks.map((track) => ({ ...track })),
    items,
    cues,
    media: draft.media.map((media) => ({ ...media })),
    records,
    tts,
  };

  assertNoForbiddenLegacyFields(manifest);
  return manifest;
}

export function assertNoForbiddenLegacyFields(payload: unknown): void {
  if (!payload || typeof payload !== "object") return;

  for (const [key, value] of Object.entries(payload)) {
    if (forbiddenLegacyFields.has(key)) {
      throw new Error(`manifest contains forbidden legacy field ${key}`);
    }

    if (Array.isArray(value)) {
      for (const item of value) assertNoForbiddenLegacyFields(item);
      continue;
    }

    assertNoForbiddenLegacyFields(value);
  }
}
