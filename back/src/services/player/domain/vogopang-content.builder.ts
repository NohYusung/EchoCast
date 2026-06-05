import type { PlayerDraft, RecordDraft } from "./player-draft.types";
import type {
  VogopangContent,
  VogopangContentAudioTrack,
  VogopangContentRecord,
  VogopangContentSpoint,
  VogopangContentTrack,
} from "./vogopang-content.types";

const DEFAULT_TRANSITION_EFFECT = { before_ms: 0, after_ms: 0 };

export function buildVogopangContent(draft: PlayerDraft): VogopangContent {
  const imageMedia = draft.media
    .filter((media) => media.kind === "image");
  const scriptsById = new Map(draft.scripts.map((script) => [script.id, script]));
  const charactersById = new Map(
    draft.characters.map((character) => [character.id, character]),
  );
  const approvedRecordByCueId = new Map(
    draft.records
      .filter((record) => record.status === "approved")
      .map((record) => [record.cueId, record]),
  );
  const cues = [...draft.cues].sort((a, b) => a.startTime - b.startTime);
  const imageHeight = imageMedia.reduce(
    (sum, media) => sum + (media.naturalHeight ?? 1200),
    0,
  );
  const markerHeight = Math.max(imageHeight, cues.length * 900, 1);

  const spoints: VogopangContentSpoint[] = cues.map((cue, index) => {
    const ratio = cues.length <= 1 ? 0 : index / (cues.length - 1);
    return {
      uuid: `spoint-${cue.id}`,
      top: Math.round(ratio * markerHeight),
      time_ms: cue.startTime,
      transition_effect: { ...DEFAULT_TRANSITION_EFFECT },
    };
  });

  const finalTimeMs = Math.max(0, ...cues.map((cue) => cue.endTime));
  if (finalTimeMs > 0) {
    spoints.push({
      uuid: "spoint-episode-end",
      top: markerHeight,
      time_ms: finalTimeMs,
      transition_effect: { ...DEFAULT_TRANSITION_EFFECT },
    });
  }

  const trackByCharacterId = new Map<string, VogopangContentTrack>();
  cues.forEach((cue, index) => {
    const character = charactersById.get(cue.characterId);
    const script = scriptsById.get(cue.scriptId);
    if (!character || !script) {
      return;
    }

    const track =
      trackByCharacterId.get(character.id) ??
      ({
        character_uuid: character.id,
        character_name: character.name,
        holes: [],
      } satisfies VogopangContentTrack);
    const approvedRecord = approvedRecordByCueId.get(cue.id);

    track.holes.push({
      uuid: cue.id,
      script_uuid: script.id,
      start_ms: cue.startTime,
      duration_ms: cue.endTime - cue.startTime,
      tts_uuid: cue.ttsVoiceId,
      script: script.text,
      index,
      records: [resolveVogopangRecord({ cue, approvedRecord })],
    });
    trackByCharacterId.set(character.id, track);
  });

  return {
    images: imageMedia.map((media, index) => ({
      uuid: media.id,
      realname: media.id,
      order: index,
      src: media.url,
      url: media.url,
    })),
    replace_images: [],
    format_version: "V1",
    spoints,
    tracks: [...trackByCharacterId.values()],
    audio_tracks: buildAudioTracks(draft),
    effects: (draft.screenEffects ?? []).map((effect) => ({
      type: "effect",
      uuid: effect.uuid,
      time_ms: effect.time_ms,
      params: { ...effect.params },
    })),
  };
}

function resolveVogopangRecord({
  cue,
  approvedRecord,
}: {
  cue: PlayerDraft["cues"][number];
  approvedRecord?: RecordDraft;
}): VogopangContentRecord {
  if (approvedRecord) {
    return {
      src: approvedRecord.audioUrl,
      artist_no: Number(approvedRecord.artistId.replace(/\D/g, "")) || 0,
      margin: 0,
    };
  }

  return {
    src: cue.ttsUrl ?? "",
    artist_no: -100,
    margin: 0,
  };
}

function buildAudioTracks(draft: PlayerDraft): VogopangContentAudioTrack[] {
  const mediaById = new Map(draft.media.map((media) => [media.id, media]));

  return draft.tracks
    .filter((track) => track.kind === "audio" || track.kind === "effect")
    .map((track) => {
      const clips = draft.timelineItems
        .filter((item) => item.trackId === track.id && item.mediaId)
        .map((item) => {
          const media = mediaById.get(item.mediaId ?? "");
          const durationMs =
            media?.durationMs ?? Math.max(0, item.endTime - item.startTime);

          return {
            src: media?.url,
            url: media?.url,
            rawSrc: media?.url,
            start_ms: item.startTime,
            duration_ms: durationMs,
            trim_left_ms: item.trimStartTime ?? 0,
            trim_right_ms: item.trimEndTime ?? 0,
          };
        });

      return {
        uuid: track.id,
        name: track.name,
        graph: [],
        clips,
      };
    })
    .filter((track) => track.clips.length > 0);
}
