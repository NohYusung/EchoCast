import type {
  PlaybackManifest,
  StoryAuthoringDocument,
  StoryStripVideoItem,
} from "@/data/playbackV2Types";
import type {
  VogopangContentImage,
  VogopangContentInlineMedia,
  VogopangContentSpoint,
  VogopangContentTrack,
  VogopangContentHole,
} from "@/data/vogopangContentTypes";

export interface PlaybackV2StoryRenderSource {
  images: VogopangContentImage[];
  inlineMedia: VogopangContentInlineMedia[];
}

export interface PlaybackContentAccessSource {
  format_version?: string;
  images?: VogopangContentImage[];
  inline_media?: VogopangContentInlineMedia[];
  spoints?: Array<Partial<VogopangContentSpoint> & { time_ms?: number }>;
  authoring_document?: StoryAuthoringDocument | null;
  playback_manifest?: PlaybackManifest | null;
}

export type PlaybackContentSceneMarker = {
  positionRatio?: number;
  top?: number;
  time_ms: number;
  startMs: number;
  index: number;
};

export type PlaybackContentVoiceHole = VogopangContentHole & {
  character_uuid?: string;
  characterName: string;
};

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function imagesFromAuthoringDocument(
  authoringDocument?: StoryAuthoringDocument | null,
): VogopangContentImage[] {
  if (!authoringDocument) return [];
  return [...authoringDocument.storyStrip.panels]
    .sort((a, b) => a.order - b.order)
    .map((panel) => panel.source);
}

export function buildPlaybackV2StoryRenderSource(params: {
  authoringDocument?: StoryAuthoringDocument | null;
  playbackManifest?: PlaybackManifest | null;
}): PlaybackV2StoryRenderSource | null {
  const { authoringDocument, playbackManifest } = params;
  if (!authoringDocument || !playbackManifest) return null;

  const visualCueBySourceId = new Map(
    playbackManifest.visualCues
      .filter((cue) => cue.type === "inline-media" && cue.sourceRef?.id)
      .map((cue) => [cue.sourceRef?.id ?? "", cue]),
  );

  const inlineMedia = authoringDocument.storyStrip.items
    .filter((item): item is StoryStripVideoItem => item.type === "video")
    .map((item) => {
      const cue = visualCueBySourceId.get(item.id);
      return {
        type: "youtube" as const,
        mode: "inline" as const,
        src: item.source.src,
        embedUrl: item.source.embedUrl,
        title: item.source.title,
        after_image_order: item.placement.afterImageOrder,
        ...(item.metadata?.afterScriptLineId
          ? { after_script_uuid: item.metadata.afterScriptLineId }
          : {}),
        ...(item.metadata?.beforeScriptLineId
          ? { before_script_uuid: item.metadata.beforeScriptLineId }
          : {}),
        start_ms: cue?.startMs ?? 0,
        duration_ms: cue?.durationMs ?? 0,
        aspect_ratio: item.layout.aspectRatio,
        render_image_order: item.placement.anchorImageOrder,
        render_image_offset_ratio: item.placement.offsetRatio,
      };
    });

  return {
    images: imagesFromAuthoringDocument(authoringDocument),
    inlineMedia,
  };
}

export function getPlaybackContentStoryRenderSource(
  content?: PlaybackContentAccessSource | null,
): PlaybackV2StoryRenderSource | null {
  return buildPlaybackV2StoryRenderSource({
    authoringDocument: content?.authoring_document,
    playbackManifest: content?.playback_manifest,
  });
}

export function getPlaybackContentImages(
  content?: PlaybackContentAccessSource | null,
): VogopangContentImage[] {
  const authoringImages = imagesFromAuthoringDocument(content?.authoring_document);
  if (authoringImages.length > 0) return authoringImages;
  return Array.isArray(content?.images) ? content.images : [];
}

export function hasPlayableContentImages(
  content?: PlaybackContentAccessSource | null,
): boolean {
  return getPlaybackContentImages(content).length > 0;
}

export function getPlaybackContentManifest(
  content?: PlaybackContentAccessSource | null,
): PlaybackManifest | null {
  return content?.playback_manifest ?? null;
}

export function getPlaybackContentSceneMarkers(
  content?: PlaybackContentAccessSource | null,
): PlaybackContentSceneMarker[] {
  const keyframes = content?.playback_manifest?.cameraPath.keyframes ?? [];
  if (keyframes.length > 0) {
    return [...keyframes]
      .sort((a, b) => a.timeMs - b.timeMs)
      .map((keyframe, index) => ({
        index,
        time_ms: keyframe.timeMs,
        startMs: keyframe.timeMs,
        ...(finiteNumber(keyframe.positionRatio) != null
          ? { positionRatio: finiteNumber(keyframe.positionRatio) }
          : {}),
        ...(finiteNumber(keyframe.top) != null ? { top: finiteNumber(keyframe.top) } : {}),
      }));
  }

  const segments = content?.playback_manifest?.cameraPath.segments ?? [];
  if (segments.length > 0) {
    const markers = segments.flatMap((segment) => [
      { timeMs: segment.startMs, y: segment.fromY },
      { timeMs: segment.endMs, y: segment.toY },
    ]);
    const uniqueMarkers = new Map<string, { timeMs: number; y: number }>();
    markers.forEach((marker) => {
      uniqueMarkers.set(`${marker.timeMs}:${marker.y}`, marker);
    });
    return [...uniqueMarkers.values()]
      .sort((a, b) => a.timeMs - b.timeMs)
      .map((marker, index) => ({
        index,
        time_ms: marker.timeMs,
        startMs: marker.timeMs,
        top: marker.y,
      }));
  }

  return (content?.spoints ?? [])
    .map((spoint, index) => {
      const timeMs = finiteNumber(spoint.time_ms ?? spoint.startMs);
      if (timeMs == null) return null;
      return {
        index,
        time_ms: timeMs,
        startMs: timeMs,
        ...(finiteNumber(spoint.positionRatio) != null
          ? { positionRatio: finiteNumber(spoint.positionRatio) }
          : {}),
        ...(finiteNumber(spoint.top) != null ? { top: finiteNumber(spoint.top) } : {}),
      };
    })
    .filter((marker): marker is PlaybackContentSceneMarker => marker != null);
}

export function getPlaybackContentVoiceHoles(
  content?: PlaybackContentAccessSource | null,
): PlaybackContentVoiceHole[] {
  if (content?.authoring_document && content.playback_manifest) {
    const voiceCueByLineId = new Map(
      content.playback_manifest.audioCues
        .filter((cue) => cue.type === "voice")
        .map((cue) => [cue.sourceRef.id, cue]),
    );

    return content.authoring_document.beats
      .flatMap((beat) =>
        beat.voiceLines.map((line): PlaybackContentVoiceHole => {
          const cue = voiceCueByLineId.get(line.id);
          return {
            uuid: line.id,
            script_uuid: line.scriptLineId,
            start_ms: cue?.startMs ?? 0,
            duration_ms: cue?.durationMs ?? line.sourceDurationMs,
            script: line.text,
            index: cue?.startMs ?? 0,
            records: line.source.src
              ? [
                  {
                    src: line.source.src,
                    artist_no: line.source.artistNo ?? 0,
                    ...(line.source.effects != null ? { effects: line.source.effects } : {}),
                  },
                ]
              : [],
            character_uuid: line.characterId,
            characterName: line.characterName,
          };
        }),
      )
      .sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0));
  }

  const tracks = Array.isArray((content as { tracks?: unknown } | null | undefined)?.tracks)
    ? ((content as { tracks?: VogopangContentTrack[] }).tracks ?? [])
    : [];
  return tracks
    .flatMap((track) =>
      (track.holes ?? []).map((hole): PlaybackContentVoiceHole => ({
        ...hole,
        character_uuid: track.character_uuid,
        characterName: track.character_name,
      })),
    )
    .sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0));
}
