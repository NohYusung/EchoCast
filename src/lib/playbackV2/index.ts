import type {
  AudioCueScheduleItem,
  AuthoringAssetCatalog,
  AuthoringVisualCue,
  CameraPathSampleMetrics,
  ContentAnchor,
  PlaybackAudioAsset,
  IndexedCameraPath,
  PlaybackAudioCue,
  PlaybackCameraPath,
  PlaybackManifest,
  PlaybackTimelineIndex,
  PlaybackV2Envelope,
  PlaybackVoiceAssetMode,
  StoryAuthoringDocument,
  StoryBeat,
  StoryPanel,
  StoryScene,
  StoryStripImageItem,
  StoryStripItem,
  StoryStripVideoItem,
  VoiceLine,
  SoundCue,
} from "@/data/playbackV2Types";
import type {
  PlaybackV2RuntimeContent,
  VogopangContent,
  VogopangContentAudioClip,
  VogopangContentAudioTrack,
  VogopangContentImage,
  VogopangContentInlineMedia,
  VogopangContentSpoint,
  VogopangContentTrack,
} from "@/data/vogopangContentTypes";

export type VogopangContentWithPlaybackV2 = VogopangContent & {
  playback_manifest?: PlaybackManifest;
  authoring_document?: StoryAuthoringDocument;
};

interface MigrateLegacyContentToPlaybackV2Params {
  playerKey: string;
  title?: string;
  legacyContent: VogopangContent;
  voiceAssetMode?: PlaybackVoiceAssetMode;
  characterVoiceAssetBasePath?: string;
}

interface CompilePlaybackManifestParams {
  playerKey: string;
  authoringDocument: StoryAuthoringDocument;
  voiceAssetMode?: PlaybackVoiceAssetMode;
  characterVoiceAssetBasePath?: string;
}

type BeatEvent =
  | {
      kind: "camera";
      timeMs: number;
      anchor: ContentAnchor;
      holdBeforeMs: number;
      holdAfterMs: number;
    }
  | {
      kind: "voice";
      timeMs: number;
      voiceLine: VoiceLine;
    }
  | {
      kind: "sound";
      timeMs: number;
      soundCue: SoundCue;
    }
  | {
      kind: "visual";
      timeMs: number;
      visualCue: AuthoringVisualCue;
    };

const PLAYBACK_V2_SCHEMA_VERSION = "playback-v2.beat.mock.1" as const;
const AUTHORING_SCHEMA_VERSION = "story-authoring.beat.mock.1" as const;
const MANIFEST_SCHEMA_VERSION = "playback-manifest.beat.mock.1" as const;
const CARTOON_IMAGE_HEIGHT_UNITS = 1.5;
const CARTOON_BASE_WIDTH_PX = 460;
const DEFAULT_INLINE_MEDIA_ASPECT_RATIO = "16 / 9";
const DEFAULT_INLINE_MEDIA_HEIGHT_UNITS = 9 / 16;
const INLINE_MEDIA_VISUAL_MARKER_WINDOW_MS = 250;
const DEFAULT_CHARACTER_VOICE_ASSET_BASE_PATH = "/mock/character-voices";

function finiteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function generatedDocumentId(playerKey: string): string {
  return `authoring:${playerKey}`;
}

function generatedManifestId(playerKey: string): string {
  return `manifest:${playerKey}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function beatId(playerKey: string, timeMs: number): string {
  return `beat:${playerKey}:${Math.round(timeMs)}`;
}

function sceneId(playerKey: string): string {
  return `scene:${playerKey}:main`;
}

function characterVoiceAssetId(characterId: string): string {
  return `asset:voice-character:${characterId}`;
}

function characterVoiceAssetSrc(params: {
  playerKey: string;
  characterId: string;
  basePath?: string;
}): string {
  const basePath = trimTrailingSlash(
    params.basePath || DEFAULT_CHARACTER_VOICE_ASSET_BASE_PATH,
  );
  return `${basePath}/${encodeURIComponent(params.playerKey)}/${encodeURIComponent(
    params.characterId,
  )}.mp3`;
}

function panelIdForImage(image: VogopangContentImage, index: number): string {
  return `panel:${String(image.uuid || `image-${index + 1}`)}`;
}

function cloneImages(images: VogopangContentImage[]): VogopangContentImage[] {
  return images.map((image) => ({ ...image }));
}

function cloneTracks(tracks: VogopangContentTrack[]): VogopangContentTrack[] {
  return tracks.map((track) => ({
    ...track,
    holes: (track.holes ?? []).map((hole) => ({
      ...hole,
      records: (hole.records ?? []).map((record) => ({ ...record })),
    })),
  }));
}

function normalizeAudioTrack(track: VogopangContentAudioTrack, trackIndex: number): VogopangContentAudioTrack {
  const trackUuid = String(track.uuid ?? `audio-track-${trackIndex + 1}`);
  return {
    ...track,
    uuid: trackUuid,
    clips: (track.clips ?? []).map((clip, clipIndex) => ({
      ...clip,
      uuid: String(clip.uuid ?? `${trackUuid}:clip-${clipIndex}`),
      start_ms: finiteNumber(clip.start_ms),
      duration_ms: finiteNumber(clip.duration_ms),
      trim_left_ms: finiteNumber(clip.trim_left_ms),
      trim_right_ms: finiteNumber(clip.trim_right_ms),
    })),
  };
}

function cloneAudioTracks(audioTracks: VogopangContentAudioTrack[] | undefined): VogopangContentAudioTrack[] {
  return (audioTracks ?? []).map((track, index) => normalizeAudioTrack(track, index));
}

function getYouTubeVideoId(src: string): string | null {
  try {
    const url = new URL(src);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const embedMatch = url.pathname.match(/^\/embed\/([^/?#]+)/);
      return embedMatch?.[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function toYouTubeEmbedUrl(src: string): string | null {
  const id = getYouTubeVideoId(src);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?rel=0&playsinline=1&mute=1&enablejsapi=1`;
}

function normalizeInlineMedia(media: VogopangContentInlineMedia): VogopangContentInlineMedia | null {
  const src = typeof media.src === "string" ? media.src.trim() : "";
  const explicitEmbedUrl = typeof media.embedUrl === "string" ? media.embedUrl.trim() : "";
  const embedUrl = explicitEmbedUrl || (src ? toYouTubeEmbedUrl(src) : null);
  const afterImageOrder = finiteNumber(media.after_image_order, Number.NaN);
  if (!src || !embedUrl || !Number.isFinite(afterImageOrder)) return null;

  const startMs = finiteNumber(media.start_ms ?? media.startMs, Number.NaN);
  const durationMs = finiteNumber(media.duration_ms ?? media.durationMs, Number.NaN);

  return {
    ...media,
    type: "youtube",
    mode: "inline",
    src,
    embedUrl,
    after_image_order: afterImageOrder,
    aspect_ratio:
      typeof media.aspect_ratio === "string" && media.aspect_ratio.trim()
        ? media.aspect_ratio.trim()
        : DEFAULT_INLINE_MEDIA_ASPECT_RATIO,
    ...(Number.isFinite(startMs) && startMs >= 0 ? { start_ms: startMs } : {}),
    ...(Number.isFinite(durationMs) && durationMs > 0 ? { duration_ms: durationMs } : {}),
  };
}

function cloneInlineMedia(inlineMedia: VogopangContentInlineMedia[] | undefined): VogopangContentInlineMedia[] {
  return (inlineMedia ?? []).flatMap((media) => {
    const normalized = normalizeInlineMedia(media);
    return normalized ? [{ ...normalized }] : [];
  });
}

function sortedImages(images: VogopangContentImage[]): VogopangContentImage[] {
  return cloneImages(images).sort(
    (a, b) => finiteNumber(a.order, 0) - finiteNumber(b.order, 0),
  );
}

function buildStoryPanels(images: VogopangContentImage[]): StoryPanel[] {
  return sortedImages(images).map((image, index) => ({
    id: panelIdForImage(image, index),
    order: finiteNumber(image.order, index + 1),
    source: { ...image },
    layout: {
      topUnits: index * CARTOON_IMAGE_HEIGHT_UNITS,
      heightUnits: CARTOON_IMAGE_HEIGHT_UNITS,
      aspectRatio: "2 / 3",
    },
  }));
}

function storyStripImageItems(panels: StoryPanel[]): StoryStripImageItem[] {
  return panels.map((panel) => ({
    id: String(panel.source.uuid || panel.id.replace(/^panel:/, "")),
    type: "image",
    panelId: panel.id,
    order: panel.order,
    source: { ...panel.source },
    layout: {
      heightUnits: panel.layout.heightUnits,
      aspectRatio: panel.layout.aspectRatio,
    },
  }));
}

function parseAspectRatioHeightUnits(value: string | undefined): number {
  const raw = value?.trim();
  if (!raw) return DEFAULT_INLINE_MEDIA_HEIGHT_UNITS;

  const ratioMatch = raw.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (ratioMatch) {
    const width = Number(ratioMatch[1]);
    const height = Number(ratioMatch[2]);
    if (width > 0 && height > 0) return height / width;
  }

  const numericRatio = Number(raw);
  if (Number.isFinite(numericRatio) && numericRatio > 0) return 1 / numericRatio;
  return DEFAULT_INLINE_MEDIA_HEIGHT_UNITS;
}

function storyStripVideoItems(inlineMedia: VogopangContentInlineMedia[]): StoryStripVideoItem[] {
  return inlineMedia.map((media, index) => {
    const anchorImageOrder = finiteNumber(
      media.render_image_order ?? media.after_image_order,
      media.after_image_order,
    );
    const boundedOffsetRatio = Math.min(
      1,
      Math.max(0, finiteNumber(media.render_image_offset_ratio, 1)),
    );
    const aspectRatio = media.aspect_ratio ?? DEFAULT_INLINE_MEDIA_ASPECT_RATIO;
    return {
      id: `inline-media-${index}`,
      type: "video",
      order: anchorImageOrder + boundedOffsetRatio,
      source: {
        provider: "youtube",
        src: media.src,
        embedUrl: media.embedUrl ?? "",
        ...(media.title ? { title: media.title } : {}),
      },
      embedUrl: media.embedUrl ?? "",
      placement: {
        afterImageOrder: finiteNumber(media.after_image_order),
        anchorImageOrder,
        offsetRatio: boundedOffsetRatio,
      },
      layout: {
        heightUnits: parseAspectRatioHeightUnits(aspectRatio),
        aspectRatio,
      },
      ...(media.after_script_uuid || media.before_script_uuid
        ? {
            metadata: {
              ...(media.after_script_uuid ? { afterScriptLineId: media.after_script_uuid } : {}),
              ...(media.before_script_uuid ? { beforeScriptLineId: media.before_script_uuid } : {}),
            },
          }
        : {}),
    };
  });
}

function buildStoryStripItems(params: {
  panels: StoryPanel[];
  inlineMedia: VogopangContentInlineMedia[];
}): StoryStripItem[] {
  return [
    ...storyStripImageItems(params.panels),
    ...storyStripVideoItems(params.inlineMedia),
  ].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.type === b.type) return a.id.localeCompare(b.id);
    return a.type === "video" ? -1 : 1;
  });
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function markerTimeMs(spoint: VogopangContentSpoint): number {
  return finiteNumber(spoint.time_ms ?? spoint.startMs);
}

function markerPositionRatio(spoint: VogopangContentSpoint): number | undefined {
  return typeof spoint.positionRatio === "number" ? spoint.positionRatio : undefined;
}

function hasMeaningfulTopSpread(spoints: VogopangContentSpoint[]): boolean {
  const tops = spoints
    .map((spoint) => (typeof spoint.top === "number" ? spoint.top : undefined))
    .filter((top): top is number => typeof top === "number");
  if (tops.length < 2) return false;
  return Math.max(...tops) - Math.min(...tops) > 0.5;
}

function resolvePositionRatioAtTime(
  spoints: VogopangContentSpoint[],
  startMs: number,
): number | undefined {
  const markers = spoints
    .map((spoint) => ({
      timeMs: markerTimeMs(spoint),
      positionRatio: markerPositionRatio(spoint),
    }))
    .filter(
      (marker): marker is { timeMs: number; positionRatio: number } =>
        marker.positionRatio != null && Number.isFinite(marker.timeMs),
    )
    .sort((a, b) => a.timeMs - b.timeMs);
  if (markers.length === 0) return undefined;

  const nextCloseMarker = markers.find(
    (marker) =>
      marker.timeMs >= startMs &&
      marker.timeMs - startMs <= INLINE_MEDIA_VISUAL_MARKER_WINDOW_MS,
  );
  if (nextCloseMarker) return nextCloseMarker.positionRatio;
  if (startMs <= markers[0].timeMs) return markers[0].positionRatio;

  const last = markers[markers.length - 1];
  if (startMs >= last.timeMs) return last.positionRatio;

  for (let index = 0; index < markers.length - 1; index++) {
    const current = markers[index];
    const next = markers[index + 1];
    if (startMs < current.timeMs || startMs > next.timeMs) continue;
    const durationMs = next.timeMs - current.timeMs;
    if (durationMs <= 0) return current.positionRatio;
    const progress = (startMs - current.timeMs) / durationMs;
    return current.positionRatio + (next.positionRatio - current.positionRatio) * progress;
  }

  return undefined;
}

function totalPanelHeightUnits(panels: StoryPanel[]): number {
  const lastPanel = panels[panels.length - 1];
  if (!lastPanel) return 0;
  return lastPanel.layout.topUnits + lastPanel.layout.heightUnits;
}

function firstAnchor(panels: StoryPanel[]): ContentAnchor {
  return {
    panelId: panels[0]?.id ?? "panel:empty",
    ratioY: 0,
  };
}

function anchorFromViewportUnits(panels: StoryPanel[], viewportUnits: number): ContentAnchor {
  if (panels.length === 0) return firstAnchor(panels);
  const totalHeightUnits = totalPanelHeightUnits(panels);
  const clampedUnits = Math.min(totalHeightUnits, Math.max(0, viewportUnits));
  const panel =
    panels.find((item, index) => {
      const itemEndUnits = item.layout.topUnits + item.layout.heightUnits;
      const isLast = index === panels.length - 1;
      return (
        clampedUnits >= item.layout.topUnits &&
        (isLast ? clampedUnits <= itemEndUnits : clampedUnits < itemEndUnits)
      );
    }) ?? panels[panels.length - 1];
  return {
    panelId: panel.id,
    ratioY: Number(
      ((clampedUnits - panel.layout.topUnits) / panel.layout.heightUnits).toFixed(4),
    ),
  };
}

function anchorFromPositionRatio(panels: StoryPanel[], positionRatio: number): ContentAnchor {
  const totalHeightUnits = totalPanelHeightUnits(panels);
  return anchorFromViewportUnits(panels, (clampRatio(positionRatio) / 100) * totalHeightUnits);
}

function anchorViewportUnits(anchor: ContentAnchor, panels: StoryPanel[]): number {
  const panel = panels.find((item) => item.id === anchor.panelId);
  if (!panel) return 0;
  return panel.layout.topUnits + Math.min(1, Math.max(0, anchor.ratioY)) * panel.layout.heightUnits;
}

function resolveAnchorAtTime(
  spoints: VogopangContentSpoint[],
  panels: StoryPanel[],
  timeMs: number,
): ContentAnchor {
  const ratio = resolvePositionRatioAtTime(spoints, timeMs);
  if (ratio != null) return anchorFromPositionRatio(panels, ratio);

  const topMarkers = spoints
    .map((spoint) => ({
      timeMs: markerTimeMs(spoint),
      top: finiteNumber(spoint.top, Number.NaN),
    }))
    .filter((marker): marker is { timeMs: number; top: number } => Number.isFinite(marker.top))
    .sort((a, b) => a.timeMs - b.timeMs);
  if (topMarkers.length === 0) return firstAnchor(panels);
  if (timeMs <= topMarkers[0].timeMs) {
    return anchorFromViewportUnits(panels, topMarkers[0].top / CARTOON_BASE_WIDTH_PX);
  }
  const last = topMarkers[topMarkers.length - 1];
  if (timeMs >= last.timeMs) return anchorFromViewportUnits(panels, last.top / CARTOON_BASE_WIDTH_PX);

  for (let index = 0; index < topMarkers.length - 1; index++) {
    const current = topMarkers[index];
    const next = topMarkers[index + 1];
    if (timeMs < current.timeMs || timeMs > next.timeMs) continue;
    const progress = (timeMs - current.timeMs) / Math.max(1, next.timeMs - current.timeMs);
    const top = current.top + (next.top - current.top) * progress;
    return anchorFromViewportUnits(panels, top / CARTOON_BASE_WIDTH_PX);
  }

  return firstAnchor(panels);
}

function resolveInlineMediaRenderPlacement(
  imageCount: number,
  visualPositionUnits: number,
): Pick<VogopangContentInlineMedia, "render_image_order" | "render_image_offset_ratio"> {
  const maxImageUnits = Math.max(0, imageCount * CARTOON_IMAGE_HEIGHT_UNITS);
  if (imageCount <= 0 || maxImageUnits <= 0) {
    return { render_image_order: 1, render_image_offset_ratio: 0 };
  }

  const clampedUnits = Math.min(maxImageUnits, Math.max(0, visualPositionUnits));
  if (clampedUnits >= maxImageUnits) {
    return { render_image_order: imageCount, render_image_offset_ratio: 1 };
  }

  const zeroBasedImageIndex = Math.floor(clampedUnits / CARTOON_IMAGE_HEIGHT_UNITS);
  const renderImageOrder = Math.min(imageCount, zeroBasedImageIndex + 1);
  const imageStartUnits = zeroBasedImageIndex * CARTOON_IMAGE_HEIGHT_UNITS;
  const offsetRatio = (clampedUnits - imageStartUnits) / CARTOON_IMAGE_HEIGHT_UNITS;
  return {
    render_image_order: renderImageOrder,
    render_image_offset_ratio: Math.min(1, Math.max(0, offsetRatio)),
  };
}

function inlineMediaStartMs(content: VogopangContent, media: VogopangContentInlineMedia): number | undefined {
  const explicitStartMs = finiteNumber(media.start_ms ?? media.startMs, Number.NaN);
  if (Number.isFinite(explicitStartMs)) return explicitStartMs;

  const holes = content.tracks.flatMap((track) => track.holes);
  if (media.before_script_uuid) {
    const beforeHole = holes.find(
      (hole) => hole.script_uuid === media.before_script_uuid || hole.uuid === media.before_script_uuid,
    );
    if (beforeHole) return beforeHole.start_ms;
  }
  if (media.after_script_uuid) {
    const afterHole = holes.find(
      (hole) => hole.script_uuid === media.after_script_uuid || hole.uuid === media.after_script_uuid,
    );
    if (afterHole) return afterHole.start_ms + afterHole.duration_ms;
  }
  return undefined;
}

function applyInlineMediaTimelineForPlaybackV2(content: VogopangContent): VogopangContent {
  const mediaItems = content.inline_media ?? [];
  if (mediaItems.length === 0) return content;

  return mediaItems.reduce((currentContent, media, mediaIndex) => {
    const currentMedia = currentContent.inline_media?.[mediaIndex] ?? media;
    const hasExistingInlineMediaMarkers = currentContent.spoints.some(
      (spoint) =>
        spoint.uuid === `inline-media-${mediaIndex}-start` ||
        spoint.uuid === `inline-media-${mediaIndex}-end`,
    );
    const existingStartMs = finiteNumber(currentMedia.start_ms, Number.NaN);
    const existingDurationMs = finiteNumber(currentMedia.duration_ms, Number.NaN);
    if (
      hasExistingInlineMediaMarkers &&
      Number.isFinite(existingStartMs) &&
      Number.isFinite(existingDurationMs) &&
      currentMedia.render_image_order != null
    ) {
      return currentContent;
    }

    const startMs = inlineMediaStartMs(currentContent, currentMedia);
    const durationMs = finiteNumber(currentMedia.duration_ms ?? currentMedia.durationMs, Number.NaN);
    if (startMs == null || !Number.isFinite(durationMs) || durationMs <= 0) {
      return currentContent;
    }

    const mediaHeightUnits = parseAspectRatioHeightUnits(currentMedia.aspect_ratio);
    const previousValidMediaItems = (currentContent.inline_media ?? [])
      .slice(0, mediaIndex)
      .filter((previousMedia) => finiteNumber(previousMedia.duration_ms ?? previousMedia.durationMs) > 0);
    const oldStripHeightUnits =
      currentContent.images.length * CARTOON_IMAGE_HEIGHT_UNITS +
      previousValidMediaItems.reduce(
        (sum, previousMedia) => sum + parseAspectRatioHeightUnits(previousMedia.aspect_ratio),
        0,
      );
    const newStripHeightUnits = oldStripHeightUnits + mediaHeightUnits;
    const previousVisualHeightBeforeInsert = previousValidMediaItems
      .filter((previousMedia) => previousMedia.after_image_order <= currentMedia.after_image_order)
      .reduce(
        (sum, previousMedia) => sum + parseAspectRatioHeightUnits(previousMedia.aspect_ratio),
        0,
      );
    const fallbackInsertPositionUnits =
      currentMedia.after_image_order * CARTOON_IMAGE_HEIGHT_UNITS +
      previousVisualHeightBeforeInsert;
    const visualPositionRatio = resolvePositionRatioAtTime(currentContent.spoints, startMs);
    const insertPositionUnits =
      visualPositionRatio != null
        ? (clampRatio(visualPositionRatio) / 100) * oldStripHeightUnits
        : fallbackInsertPositionUnits;
    const renderPlacement = resolveInlineMediaRenderPlacement(
      currentContent.images.length,
      insertPositionUnits - previousVisualHeightBeforeInsert,
    );
    const videoStartRatio = clampRatio((insertPositionUnits / newStripHeightUnits) * 100);
    const topMappingHasSpread = hasMeaningfulTopSpread(currentContent.spoints);
    const mediaTopPx = mediaHeightUnits * CARTOON_BASE_WIDTH_PX;
    const insertTopPx = insertPositionUnits * CARTOON_BASE_WIDTH_PX;
    const overlappingHoleStartMsList = currentContent.tracks
      .flatMap((track) => track.holes)
      .map((hole) => {
        const holeStartMs = finiteNumber(hole.start_ms, Number.NaN);
        const holeDurationMs = finiteNumber(hole.duration_ms);
        if (!Number.isFinite(holeStartMs) || holeDurationMs <= 0) return undefined;
        const holeEndMs = holeStartMs + holeDurationMs;
        return holeStartMs < startMs && holeEndMs > startMs ? holeStartMs : undefined;
      })
      .filter((holeStartMs): holeStartMs is number => holeStartMs != null);
    const shiftFromMs =
      overlappingHoleStartMsList.length > 0
        ? Math.min(startMs, ...overlappingHoleStartMsList)
        : startMs;
    const shiftDeltaMs = durationMs + (startMs - shiftFromMs);

    const shiftedTracks = currentContent.tracks.map((track) => ({
      ...track,
      holes: track.holes.map((hole) => {
        if (hole.start_ms < shiftFromMs) return hole;
        const shiftedStartMs = hole.start_ms + shiftDeltaMs;
        return {
          ...hole,
          start_ms: shiftedStartMs,
          index:
            typeof hole.index === "number" && Number.isFinite(hole.index)
              ? hole.index + shiftDeltaMs
              : hole.index,
        };
      }),
    }));

    const shiftedAudioTracks = currentContent.audio_tracks?.map((track) => ({
      ...track,
      clips: track.clips?.map((clip) => {
        const clipStartMs = finiteNumber(clip.start_ms, Number.NaN);
        if (!Number.isFinite(clipStartMs) || clipStartMs < shiftFromMs) return clip;
        return { ...clip, start_ms: clipStartMs + shiftDeltaMs };
      }),
    }));

    const shiftedSpoints = currentContent.spoints.map((spoint) => {
      const oldTimeMs = markerTimeMs(spoint);
      const shouldShift = oldTimeMs >= shiftFromMs;
      const shiftedTimeMs = shouldShift ? oldTimeMs + shiftDeltaMs : oldTimeMs;
      const oldPositionRatio = finiteNumber(spoint.positionRatio);
      const oldPositionUnits = (clampRatio(oldPositionRatio) / 100) * oldStripHeightUnits;
      const newPositionUnits = shouldShift ? oldPositionUnits + mediaHeightUnits : oldPositionUnits;
      const oldTop = finiteNumber(spoint.top);
      return {
        ...spoint,
        top: topMappingHasSpread && shouldShift ? oldTop + mediaTopPx : oldTop,
        time_ms: shiftedTimeMs,
        startMs: shiftedTimeMs,
        positionRatio: clampRatio((newPositionUnits / newStripHeightUnits) * 100),
      };
    });

    const mediaStartMarker: VogopangContentSpoint = {
      uuid: `inline-media-${mediaIndex}-start`,
      top: topMappingHasSpread ? insertTopPx : 0,
      time_ms: startMs,
      startMs,
      transition_effect: { before_ms: 0, after_ms: 0 },
      positionRatio: videoStartRatio,
    };
    const mediaEndMarker: VogopangContentSpoint = {
      uuid: `inline-media-${mediaIndex}-end`,
      top: topMappingHasSpread ? insertTopPx : 0,
      time_ms: startMs + durationMs,
      startMs: startMs + durationMs,
      transition_effect: { before_ms: 0, after_ms: 0 },
      positionRatio: videoStartRatio,
    };

    const spoints = [...shiftedSpoints, mediaStartMarker, mediaEndMarker]
      .sort((a, b) => {
        const timeDelta = markerTimeMs(a) - markerTimeMs(b);
        if (Math.abs(timeDelta) > 1e-9) return timeDelta;
        return (a.positionRatio ?? 0) - (b.positionRatio ?? 0);
      })
      .map((spoint, index) => ({ ...spoint, index }));
    const inlineMedia = currentContent.inline_media?.map((item, index) => {
      if (index === mediaIndex) {
        return {
          ...item,
          start_ms: startMs,
          duration_ms: durationMs,
          ...renderPlacement,
        };
      }
      const itemStartMs = finiteNumber(item.start_ms, Number.NaN);
      if (Number.isFinite(itemStartMs) && itemStartMs >= shiftFromMs) {
        return { ...item, start_ms: itemStartMs + shiftDeltaMs };
      }
      return item;
    });

    return {
      ...currentContent,
      spoints,
      tracks: shiftedTracks,
      ...(inlineMedia ? { inline_media: inlineMedia } : {}),
      ...(shiftedAudioTracks ? { audio_tracks: shiftedAudioTracks } : {}),
    };
  }, content);
}

function clipSrc(clip: VogopangContentAudioClip): string {
  return String(clip.url || clip.rawSrc || clip.src || "");
}

function buildBeatEvents(params: {
  playerKey: string;
  content: VogopangContent;
  panels: StoryPanel[];
}): BeatEvent[] {
  const cameraEvents: BeatEvent[] = (params.content.spoints ?? []).map((spoint) => ({
    kind: "camera",
    timeMs: markerTimeMs(spoint),
    anchor: resolveAnchorAtTime(params.content.spoints ?? [], params.panels, markerTimeMs(spoint)),
    holdBeforeMs: finiteNumber(spoint.transition_effect?.before_ms),
    holdAfterMs: finiteNumber(spoint.transition_effect?.after_ms),
  }));

  const voiceEvents: BeatEvent[] = cloneTracks(params.content.tracks ?? []).flatMap((track) =>
    (track.holes ?? []).map((hole) => {
      const record = hole.records?.[0];
      const id = `voice:${hole.uuid}`;
      return {
        kind: "voice",
        timeMs: finiteNumber(hole.start_ms),
        voiceLine: {
          id,
          characterId: track.character_uuid,
          characterName: track.character_name,
          scriptLineId: hole.script_uuid,
          text: hole.script,
          assetId: `asset:${id}`,
          source: {
            src: String(record?.src ?? ""),
            artistNo: finiteNumber(record?.artist_no),
            effects: record?.effects,
          },
          sourceDurationMs: finiteNumber(hole.duration_ms),
          trimLeftMs: 0,
          trimRightMs: 0,
          volume: 1,
        },
      };
    }),
  );

  const soundEvents: BeatEvent[] = cloneAudioTracks(params.content.audio_tracks).flatMap((track, trackIndex) => {
    const trackId = String(track.uuid ?? `audio-track-${trackIndex + 1}`);
    return (track.clips ?? []).map((clip, clipIndex) => {
      const clipId = String(clip.uuid ?? `${trackId}:clip-${clipIndex}`);
      const id = `sound:${clipId}`;
      return {
        kind: "sound",
        timeMs: finiteNumber(clip.start_ms),
        soundCue: {
          id,
          trackId,
          assetId: `asset:${id}`,
          source: {
            src: clipSrc(clip),
          },
          relativeOffsetMs: 0,
          sourceDurationMs: finiteNumber(clip.duration_ms),
          trimLeftMs: finiteNumber(clip.trim_left_ms),
          trimRightMs: finiteNumber(clip.trim_right_ms),
          volume: 1,
          effects: clip.effects,
        },
      };
    });
  });

  const effects = Array.isArray((params.content as { effects?: unknown }).effects)
    ? ((params.content as { effects?: Array<Record<string, unknown>> }).effects ?? [])
    : [];
  const effectEvents: BeatEvent[] = effects.map((effect, index) => ({
    kind: "visual",
    timeMs: finiteNumber(effect.time_ms),
    visualCue: {
      id: `effect:${String(effect.uuid ?? index)}`,
      type: "effect",
      relativeOffsetMs: 0,
      durationMs: finiteNumber((effect.params as { duration?: unknown } | undefined)?.duration),
      sourceRef: {
        kind: "effect",
        id: String(effect.uuid ?? index),
      },
      params: effect.params,
    },
  }));

  const inlineMediaEvents: BeatEvent[] = (params.content.inline_media ?? []).map((media, index) => ({
    kind: "visual",
    timeMs: finiteNumber(media.start_ms ?? media.startMs),
    visualCue: {
      id: `visual:inline-media-${index}`,
      type: "inline-media",
      relativeOffsetMs: 0,
      durationMs: finiteNumber(media.duration_ms ?? media.durationMs),
      sourceRef: {
        kind: "inline-media",
        id: `inline-media-${index}`,
      },
      params: {
        provider: "youtube",
        src: media.src,
        embedUrl: media.embedUrl,
        aspectRatio: media.aspect_ratio ?? DEFAULT_INLINE_MEDIA_ASPECT_RATIO,
        afterImageOrder: media.after_image_order,
        renderImageOrder: media.render_image_order,
        renderImageOffsetRatio: media.render_image_offset_ratio,
        ...(media.title ? { title: media.title } : {}),
      },
    },
  }));

  const events = [
    ...cameraEvents,
    ...voiceEvents,
    ...soundEvents,
    ...effectEvents,
    ...inlineMediaEvents,
  ].filter((event) => Number.isFinite(event.timeMs) && event.timeMs >= 0);

  if (events.length > 0) return events;

  return [
    {
      kind: "camera",
      timeMs: 0,
      anchor: firstAnchor(params.panels),
      holdBeforeMs: 0,
      holdAfterMs: 0,
    },
  ];
}

function buildStoryBeats(params: {
  playerKey: string;
  title?: string;
  content: VogopangContent;
  panels: StoryPanel[];
}): { beats: StoryBeat[]; scenes: StoryScene[] } {
  const scene = sceneId(params.playerKey);
  const events = buildBeatEvents({
    playerKey: params.playerKey,
    content: params.content,
    panels: params.panels,
  });
  const eventsByTime = new Map<number, BeatEvent[]>();
  events.forEach((event) => {
    const key = Math.round(event.timeMs);
    eventsByTime.set(key, [...(eventsByTime.get(key) ?? []), event]);
  });

  const times = [...eventsByTime.keys()].sort((a, b) => a - b);
  const beats = times.map((timeMs, index): StoryBeat => {
    const groupedEvents = eventsByTime.get(timeMs) ?? [];
    const cameraEvent = groupedEvents.find(
      (event): event is Extract<BeatEvent, { kind: "camera" }> => event.kind === "camera",
    );
    const anchor = cameraEvent?.anchor ?? resolveAnchorAtTime(params.content.spoints ?? [], params.panels, timeMs);
    const voiceLines = groupedEvents
      .filter((event): event is Extract<BeatEvent, { kind: "voice" }> => event.kind === "voice")
      .map((event) => event.voiceLine);
    const soundEffects = groupedEvents
      .filter((event): event is Extract<BeatEvent, { kind: "sound" }> => event.kind === "sound")
      .map((event) => event.soundCue);
    const screenEffects = groupedEvents
      .filter((event): event is Extract<BeatEvent, { kind: "visual" }> => event.kind === "visual")
      .map((event) => event.visualCue);
    const contentDurationMs = Math.max(
      0,
      ...voiceLines.map((line) => line.sourceDurationMs),
      ...soundEffects.map((cue) => cue.relativeOffsetMs + cue.sourceDurationMs),
      ...screenEffects.map((cue) => cue.relativeOffsetMs + cue.durationMs),
    );
    const nextTimeMs = times[index + 1];
    const minDurationMs =
      nextTimeMs != null
        ? Math.max(0, nextTimeMs - timeMs)
        : Math.max(contentDurationMs, 500);

    return {
      id: beatId(params.playerKey, timeMs),
      sceneId: scene,
      order: index,
      anchor,
      durationPolicy: voiceLines.length > 0 ? "autoByVoice" : "fixed",
      minDurationMs,
      voiceLines,
      soundEffects,
      screenEffects,
      cameraIntent: {
        movement: cameraEvent ? "moveTo" : "hold",
        target: anchor,
        easing: "linear",
        holdBeforeMs: cameraEvent?.holdBeforeMs ?? 0,
        holdAfterMs: cameraEvent?.holdAfterMs ?? 0,
      },
    };
  });

  return {
    beats,
    scenes: [
      {
        id: scene,
        title: params.title ?? params.playerKey,
        beatIds: beats.map((beat) => beat.id),
      },
    ],
  };
}

function buildAuthoringAssets(params: {
  panels: StoryPanel[];
  beats: StoryBeat[];
  inlineMedia: VogopangContentInlineMedia[];
}): AuthoringAssetCatalog {
  const audio = params.beats.flatMap((beat) => [
    ...beat.voiceLines
      .filter((line) => line.source.src)
      .map((line) => ({ id: line.assetId, type: "voice" as const, src: line.source.src })),
    ...beat.soundEffects
      .filter((cue) => cue.source.src)
      .map((cue) => ({ id: cue.assetId, type: "sfx" as const, src: cue.source.src })),
  ]);
  return {
    images: params.panels.map((panel) => ({ ...panel.source })),
    audio,
    inlineMedia: params.inlineMedia.map((media, index) => ({
      id: `inline-media-${index}`,
      provider: "youtube",
      src: media.src,
      embedUrl: media.embedUrl ?? "",
    })),
  };
}

function beatContentDurationMs(beat: StoryBeat): number {
  return Math.max(0, beat.minDurationMs);
}

function buildBeatStartMs(beats: StoryBeat[]): Map<string, number> {
  const sorted = [...beats].sort((a, b) => a.order - b.order);
  const starts = new Map<string, number>();
  let cursor = 0;
  sorted.forEach((beat) => {
    starts.set(beat.id, cursor);
    cursor += beatContentDurationMs(beat);
  });
  return starts;
}

function buildCameraPath(authoringDocument: StoryAuthoringDocument): PlaybackCameraPath {
  const panels = authoringDocument.storyStrip.panels;
  const totalHeightUnits = totalPanelHeightUnits(panels);
  const beats = [...authoringDocument.beats].sort((a, b) => a.order - b.order);
  const beatStartMs = buildBeatStartMs(beats);
  const keyframes = beats.map((beat) => {
    const viewportY = anchorViewportUnits(beat.cameraIntent.target, panels);
    const positionRatio = totalHeightUnits > 0 ? (viewportY / totalHeightUnits) * 100 : 0;
    return {
      id: `camera:${beat.id}`,
      beatId: beat.id,
      timeMs: beatStartMs.get(beat.id) ?? 0,
      viewportY,
      positionRatio,
      top: viewportY * CARTOON_BASE_WIDTH_PX,
      holdBeforeMs: beat.cameraIntent.holdBeforeMs,
      holdAfterMs: beat.cameraIntent.holdAfterMs,
    };
  });
  const durationMs = beats.reduce((sum, beat) => sum + beatContentDurationMs(beat), 0);
  const segments = beats.map((beat, index) => {
    const current = keyframes[index];
    const next = keyframes[index + 1] ?? current;
    return {
      startBeatId: beat.id,
      endBeatId: next?.beatId ?? beat.id,
      startMs: current?.timeMs ?? 0,
      endMs: next && next !== current ? next.timeMs : durationMs,
      fromY: current?.viewportY ?? 0,
      toY: next?.viewportY ?? current?.viewportY ?? 0,
      holdBeforeMs: beat.cameraIntent.holdBeforeMs,
      holdAfterMs: beat.cameraIntent.holdAfterMs,
      easing: beat.cameraIntent.easing,
    };
  });

  return {
    coordinate: "viewportY",
    totalHeightUnits,
    segments,
    keyframes,
  };
}

interface VoiceLineSourceWindow {
  assetId: string;
  src: string;
  sourceStartMs: number;
  sourceEndMs: number;
  durationMs: number;
}

function buildCharacterVoiceSourceWindows(params: {
  beats: StoryBeat[];
  playerKey: string;
  characterVoiceAssetBasePath?: string;
}): Map<string, VoiceLineSourceWindow> {
  const cursorByCharacterId = new Map<string, number>();
  const windowsByLineId = new Map<string, VoiceLineSourceWindow>();

  [...params.beats]
    .sort((a, b) => a.order - b.order)
    .forEach((beat) => {
      beat.voiceLines.forEach((line) => {
        const characterId = line.characterId;
        const sourceStartMs = cursorByCharacterId.get(characterId) ?? 0;
        const durationMs = Math.max(0, finiteNumber(line.sourceDurationMs));
        const sourceEndMs = sourceStartMs + durationMs;
        windowsByLineId.set(line.id, {
          assetId: characterVoiceAssetId(characterId),
          src: characterVoiceAssetSrc({
            playerKey: params.playerKey,
            characterId,
            basePath: params.characterVoiceAssetBasePath,
          }),
          sourceStartMs,
          sourceEndMs,
          durationMs,
        });
        cursorByCharacterId.set(characterId, sourceEndMs);
      });
    });

  return windowsByLineId;
}

function audioCuesFromBeats(params: {
  beats: StoryBeat[];
  playerKey: string;
  voiceAssetMode?: PlaybackVoiceAssetMode;
  characterVoiceAssetBasePath?: string;
}): PlaybackAudioCue[] {
  const beats = params.beats;
  const beatStartMs = buildBeatStartMs(beats);
  const voiceAssetMode = params.voiceAssetMode ?? "perLine";
  const characterVoiceSourceWindows =
    voiceAssetMode === "characterMerged"
      ? buildCharacterVoiceSourceWindows({
          beats,
          playerKey: params.playerKey,
          characterVoiceAssetBasePath: params.characterVoiceAssetBasePath,
        })
      : new Map<string, VoiceLineSourceWindow>();

  return beats
    .flatMap((beat) => {
      const beatStart = beatStartMs.get(beat.id) ?? 0;
      const voiceCues = beat.voiceLines.map((line): PlaybackAudioCue => {
        const sourceWindow = characterVoiceSourceWindows.get(line.id);
        const startMs = beatStart;
        const durationMs = sourceWindow?.durationMs ?? line.sourceDurationMs;
        const endMs = startMs + durationMs;
        const sourceStartMs = sourceWindow?.sourceStartMs ?? line.trimLeftMs;
        const sourceEndMs =
          sourceWindow?.sourceEndMs ??
          Math.max(line.trimLeftMs, line.sourceDurationMs - line.trimRightMs);
        const src = sourceWindow?.src ?? line.source.src;
        return {
          id: `audio:${line.id}`,
          type: "voice",
          beatId: beat.id,
          assetId: sourceWindow?.assetId ?? line.assetId,
          trackId: line.characterId,
          startMs,
          endMs,
          durationMs,
          sourceStartMs,
          sourceEndMs,
          trimLeftMs: line.trimLeftMs,
          trimRightMs: line.trimRightMs,
          volume: line.volume,
          sourceRef: {
            kind: "voice-line",
            id: line.id,
          },
          sources: src
            ? [
                {
                  src,
                  artistNo: line.source.artistNo,
                },
              ]
            : [],
          effects: line.source.effects,
        };
      });
      const soundCues = beat.soundEffects.map((cue): PlaybackAudioCue => {
        const startMs = beatStart + cue.relativeOffsetMs;
        const endMs = startMs + cue.sourceDurationMs;
        return {
          id: `audio:${cue.id}`,
          type: "sfx",
          beatId: beat.id,
          assetId: cue.assetId,
          trackId: cue.trackId,
          startMs,
          endMs,
          durationMs: cue.sourceDurationMs,
          sourceStartMs: cue.trimLeftMs,
          sourceEndMs: Math.max(cue.trimLeftMs, cue.sourceDurationMs - cue.trimRightMs),
          trimLeftMs: cue.trimLeftMs,
          trimRightMs: cue.trimRightMs,
          volume: cue.volume,
          sourceRef: {
            kind: "sound-cue",
            id: cue.id,
          },
          sources: cue.source.src ? [{ src: cue.source.src }] : [],
          effects: cue.effects,
        };
      });
      return [...voiceCues, ...soundCues];
    })
    .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
}

function playbackAudioAssetsFromCues(
  audioCues: PlaybackAudioCue[],
): PlaybackAudioAsset[] {
  const assetById = new Map<string, PlaybackAudioAsset>();

  audioCues.forEach((cue) => {
    const src = cue.sources[0]?.src ?? "";
    if (!src) return;

    const existing = assetById.get(cue.assetId);
    const next: PlaybackAudioAsset = existing ?? {
      id: cue.assetId,
      type: cue.type,
      src,
    };

    if (cue.type === "voice" && cue.assetId.startsWith("asset:voice-character:")) {
      next.trackId = cue.trackId;
      next.sourceMode = "characterMerged";
      next.sourceLineIds = [
        ...(next.sourceLineIds ?? []),
        ...(next.sourceLineIds?.includes(cue.sourceRef.id) ? [] : [cue.sourceRef.id]),
      ];
      next.durationMs = Math.max(next.durationMs ?? 0, cue.sourceEndMs);
    }

    assetById.set(cue.assetId, next);
  });

  return [...assetById.values()];
}

function playbackAudioAssets(params: {
  authoringDocument: StoryAuthoringDocument;
  audioCues: PlaybackAudioCue[];
  voiceAssetMode?: PlaybackVoiceAssetMode;
}): PlaybackAudioAsset[] {
  if ((params.voiceAssetMode ?? "perLine") === "characterMerged") {
    return playbackAudioAssetsFromCues(params.audioCues);
  }

  return params.authoringDocument.assets.audio.map((asset) => ({ ...asset }));
}

function visualCuesFromBeats(beats: StoryBeat[]) {
  const beatStartMs = buildBeatStartMs(beats);
  return beats
    .flatMap((beat) =>
      beat.screenEffects.map((cue) => {
        const startMs = (beatStartMs.get(beat.id) ?? 0) + cue.relativeOffsetMs;
        return {
          id: `visual:${cue.id}`,
          type: cue.type,
          beatId: beat.id,
          startMs,
          endMs: startMs + cue.durationMs,
          durationMs: cue.durationMs,
          sourceRef: cue.sourceRef,
          params: cue.params,
        };
      }),
    )
    .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
}

function manifestDurationMs(manifestParts: {
  cameraPath: PlaybackCameraPath;
  audioCues: PlaybackAudioCue[];
  visualCues: ReturnType<typeof visualCuesFromBeats>;
}): number {
  const cameraEnd = manifestParts.cameraPath.segments.at(-1)?.endMs ?? 0;
  const audioEnd = manifestParts.audioCues.reduce((max, cue) => Math.max(max, cue.endMs), 0);
  const visualEnd = manifestParts.visualCues.reduce((max, cue) => Math.max(max, cue.endMs), 0);
  return Math.max(cameraEnd, audioEnd, visualEnd);
}

export function compilePlaybackManifest(
  params: CompilePlaybackManifestParams,
): PlaybackManifest {
  const cameraPath = buildCameraPath(params.authoringDocument);
  const audioCues = audioCuesFromBeats({
    beats: params.authoringDocument.beats,
    playerKey: params.playerKey,
    voiceAssetMode: params.voiceAssetMode,
    characterVoiceAssetBasePath: params.characterVoiceAssetBasePath,
  });
  const visualCues = visualCuesFromBeats(params.authoringDocument.beats);
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    id: generatedManifestId(params.playerKey),
    sourceDocumentId: params.authoringDocument.id,
    cameraPath,
    audioCues,
    visualCues,
    assetManifest: {
      images: params.authoringDocument.assets.images,
      audio: playbackAudioAssets({
        authoringDocument: params.authoringDocument,
        audioCues,
        voiceAssetMode: params.voiceAssetMode,
      }),
      inlineMedia: params.authoringDocument.assets.inlineMedia,
    },
    durationMs: manifestDurationMs({ cameraPath, audioCues, visualCues }),
  };
}

export function migrateLegacyContentToPlaybackV2(
  params: MigrateLegacyContentToPlaybackV2Params,
): PlaybackV2Envelope {
  const normalizedLegacyContent = applyInlineMediaTimelineForPlaybackV2({
    ...params.legacyContent,
    inline_media: cloneInlineMedia(params.legacyContent.inline_media),
  });
  const panels = buildStoryPanels(normalizedLegacyContent.images ?? []);
  const inlineMedia = cloneInlineMedia(normalizedLegacyContent.inline_media);
  const { beats, scenes } = buildStoryBeats({
    playerKey: params.playerKey,
    title: params.title,
    content: normalizedLegacyContent,
    panels,
  });
  const authoringDocument: StoryAuthoringDocument = {
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    id: generatedDocumentId(params.playerKey),
    ...(params.title ? { title: params.title } : {}),
    storyStrip: {
      coordinate: "vertical-units",
      panels,
      items: buildStoryStripItems({ panels, inlineMedia }),
      replaceImages: Array.isArray(normalizedLegacyContent.replace_images)
        ? normalizedLegacyContent.replace_images
        : [],
    },
    scenes,
    beats,
    assets: buildAuthoringAssets({ panels, beats, inlineMedia }),
  };
  const playbackManifest = compilePlaybackManifest({
    playerKey: params.playerKey,
    authoringDocument,
    voiceAssetMode: params.voiceAssetMode,
    characterVoiceAssetBasePath: params.characterVoiceAssetBasePath,
  });

  return {
    schemaVersion: PLAYBACK_V2_SCHEMA_VERSION,
    playerKey: params.playerKey,
    ...(params.title ? { title: params.title } : {}),
    authoringDocument,
    playbackManifest,
    compatibility: {
      migratedFrom: "vogopang-content",
      legacyFormatVersion: params.legacyContent.format_version ?? "unknown",
    },
  };
}

export function isPlaybackV2Envelope(value: unknown): value is PlaybackV2Envelope {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  const manifest = record?.playbackManifest as Record<string, unknown> | undefined;
  const authoringDocument = record?.authoringDocument as Record<string, unknown> | undefined;
  return Boolean(
    record?.schemaVersion === PLAYBACK_V2_SCHEMA_VERSION &&
      manifest?.schemaVersion === MANIFEST_SCHEMA_VERSION &&
      authoringDocument?.schemaVersion === AUTHORING_SCHEMA_VERSION,
  );
}

function contentImagesFromAuthoring(authoringDocument: StoryAuthoringDocument): VogopangContentImage[] {
  return authoringDocument.storyStrip.panels.map((panel) => ({ ...panel.source }));
}

function spointsFromManifest(manifest: PlaybackManifest): VogopangContentSpoint[] {
  return manifest.cameraPath.keyframes.map((keyframe, index) => ({
    uuid: keyframe.id,
    index,
    top: finiteNumber(keyframe.top),
    time_ms: keyframe.timeMs,
    startMs: keyframe.timeMs,
    transition_effect: {
      before_ms: keyframe.holdBeforeMs,
      after_ms: keyframe.holdAfterMs,
    },
    ...(typeof keyframe.positionRatio === "number"
      ? { positionRatio: keyframe.positionRatio }
      : {}),
  }));
}

function tracksFromAuthoringAndManifest(
  authoringDocument: StoryAuthoringDocument,
  manifest: PlaybackManifest,
): VogopangContentTrack[] {
  const voiceCueByLineId = new Map(
    manifest.audioCues
      .filter((cue) => cue.type === "voice")
      .map((cue) => [cue.sourceRef.id, cue]),
  );
  const trackByCharacter = new Map<string, VogopangContentTrack>();
  authoringDocument.beats.forEach((beat) => {
    beat.voiceLines.forEach((line) => {
      const cue = voiceCueByLineId.get(line.id);
      const track =
        trackByCharacter.get(line.characterId) ??
        {
          character_uuid: line.characterId,
          character_name: line.characterName,
          holes: [],
        };
      track.holes.push({
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
      });
      trackByCharacter.set(line.characterId, track);
    });
  });
  return [...trackByCharacter.values()].map((track) => ({
    ...track,
    holes: [...track.holes].sort((a, b) => a.start_ms - b.start_ms),
  }));
}

function audioTracksFromAuthoringAndManifest(
  authoringDocument: StoryAuthoringDocument,
  manifest: PlaybackManifest,
): VogopangContentAudioTrack[] | undefined {
  const soundCueById = new Map(
    manifest.audioCues
      .filter((cue) => cue.type === "sfx")
      .map((cue) => [cue.sourceRef.id, cue]),
  );
  const trackById = new Map<string, VogopangContentAudioTrack>();
  authoringDocument.beats.forEach((beat) => {
    beat.soundEffects.forEach((sound) => {
      const cue = soundCueById.get(sound.id);
      const track =
        trackById.get(sound.trackId) ??
        {
          uuid: sound.trackId,
          clips: [],
        };
      track.clips = [
        ...(track.clips ?? []),
        {
          uuid: sound.id,
          src: sound.source.src,
          start_ms: cue?.startMs ?? 0,
          duration_ms: cue?.durationMs ?? sound.sourceDurationMs,
          trim_left_ms: sound.trimLeftMs,
          trim_right_ms: sound.trimRightMs,
          ...(sound.effects != null ? { effects: sound.effects } : {}),
        },
      ];
      trackById.set(sound.trackId, track);
    });
  });
  const tracks = [...trackById.values()].map((track) => ({
    ...track,
    clips: [...(track.clips ?? [])].sort((a, b) => finiteNumber(a.start_ms) - finiteNumber(b.start_ms)),
  }));
  return tracks.length > 0 ? tracks : undefined;
}

function inlineMediaFromAuthoringAndManifest(
  authoringDocument: StoryAuthoringDocument,
  manifest: PlaybackManifest,
): VogopangContentInlineMedia[] | undefined {
  const visualCueBySourceId = new Map(
    manifest.visualCues
      .filter((cue) => cue.type === "inline-media" && cue.sourceRef?.id)
      .map((cue) => [cue.sourceRef?.id ?? "", cue]),
  );
  const media = authoringDocument.storyStrip.items
    .filter((item): item is StoryStripVideoItem => item.type === "video")
    .map((item) => {
      const cue = visualCueBySourceId.get(item.id);
      return {
        type: "youtube" as const,
        mode: "inline" as const,
        src: item.source.src,
        embedUrl: item.source.embedUrl,
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
        ...(item.source.title ? { title: item.source.title } : {}),
      };
    });
  return media.length > 0 ? media : undefined;
}

export function adaptPlaybackV2EnvelopeToVogopangContent(
  envelope: PlaybackV2Envelope,
): VogopangContentWithPlaybackV2 {
  const audioTracks = audioTracksFromAuthoringAndManifest(
    envelope.authoringDocument,
    envelope.playbackManifest,
  );
  const inlineMedia = inlineMediaFromAuthoringAndManifest(
    envelope.authoringDocument,
    envelope.playbackManifest,
  );
  return {
    images: contentImagesFromAuthoring(envelope.authoringDocument),
    replace_images: envelope.authoringDocument.storyStrip.replaceImages,
    format_version: "V2",
    spoints: spointsFromManifest(envelope.playbackManifest),
    tracks: tracksFromAuthoringAndManifest(envelope.authoringDocument, envelope.playbackManifest),
    ...(audioTracks ? { audio_tracks: audioTracks } : {}),
    ...(inlineMedia ? { inline_media: inlineMedia } : {}),
    playback_manifest: envelope.playbackManifest,
    authoring_document: envelope.authoringDocument,
  };
}

export function adaptPlaybackV2EnvelopeToRuntimeContent(
  envelope: PlaybackV2Envelope,
): PlaybackV2RuntimeContent {
  return {
    replace_images: envelope.authoringDocument.storyStrip.replaceImages,
    format_version: "V2",
    playback_manifest: envelope.playbackManifest,
    authoring_document: envelope.authoringDocument,
  };
}

export function createPlaybackTimelineIndex(
  manifest: PlaybackManifest,
): PlaybackTimelineIndex {
  return {
    cameraPath: {
      coordinate: manifest.cameraPath.coordinate,
      totalHeightUnits: manifest.cameraPath.totalHeightUnits,
      segments: [...manifest.cameraPath.segments].sort((a, b) => a.startMs - b.startMs),
      keyframes: [...manifest.cameraPath.keyframes].sort((a, b) => a.timeMs - b.timeMs),
    },
    audioCues: [...manifest.audioCues].sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id)),
    visualCues: [...manifest.visualCues].sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id)),
  };
}

function scrollRangeFor(metrics: CameraPathSampleMetrics): number {
  const range = metrics.scrollHeight - metrics.viewportHeight;
  if (Number.isFinite(range) && range > 0) return range;
  if (Number.isFinite(metrics.scrollHeight) && metrics.scrollHeight > 0) return metrics.scrollHeight;
  return Math.max(0, metrics.currentScrollTop);
}

function viewportYToScrollTop(
  cameraPath: IndexedCameraPath,
  viewportY: number,
  metrics: CameraPathSampleMetrics,
): number {
  const totalHeightUnits = cameraPath.totalHeightUnits ?? 0;
  if (totalHeightUnits <= 0) return 0;
  return (viewportY / totalHeightUnits) * scrollRangeFor(metrics);
}

function keyframeScrollTop(
  cameraPath: IndexedCameraPath,
  keyframe: { viewportY?: number; positionRatio?: number; top?: number },
  metrics: CameraPathSampleMetrics,
): number {
  if (cameraPath.coordinate === "viewportY") {
    return viewportYToScrollTop(cameraPath, finiteNumber(keyframe.viewportY), metrics);
  }
  if (cameraPath.coordinate === "positionRatio") {
    return (finiteNumber(keyframe.positionRatio) / 100) * scrollRangeFor(metrics);
  }
  return finiteNumber(keyframe.top);
}

function segmentScrollTop(
  cameraPath: IndexedCameraPath,
  viewportY: number,
  metrics: CameraPathSampleMetrics,
): number {
  if (cameraPath.coordinate === "viewportY") {
    return viewportYToScrollTop(cameraPath, viewportY, metrics);
  }
  return viewportY;
}

function easeProgress(progress: number, easing: "linear" | "easeInOut" | "hold"): number {
  if (easing === "hold") return 0;
  if (easing === "easeInOut") return progress * progress * (3 - 2 * progress);
  return progress;
}

export function sampleCameraPath(
  cameraPath: IndexedCameraPath,
  timeMs: number,
  metrics: CameraPathSampleMetrics,
): number {
  const segments = cameraPath.segments;
  if (segments.length > 0) {
    const first = segments[0];
    if (timeMs <= first.startMs) {
      return segmentScrollTop(cameraPath, first.fromY, metrics);
    }
    const last = segments[segments.length - 1];
    if (timeMs >= last.endMs) {
      return segmentScrollTop(cameraPath, last.toY, metrics);
    }
    const segment =
      segments.find((item) => timeMs >= item.startMs && timeMs < item.endMs) ?? last;
    const durationMs = Math.max(1, segment.endMs - segment.startMs);
    const elapsedMs = timeMs - segment.startMs;
    if (elapsedMs < segment.holdBeforeMs) {
      return segmentScrollTop(cameraPath, segment.fromY, metrics);
    }
    if (elapsedMs > durationMs - segment.holdAfterMs) {
      return segmentScrollTop(cameraPath, segment.toY, metrics);
    }
    const animStartMs = segment.startMs + segment.holdBeforeMs;
    const animEndMs = segment.endMs - segment.holdAfterMs;
    const progress = easeProgress(
      Math.min(1, Math.max(0, (timeMs - animStartMs) / Math.max(1, animEndMs - animStartMs))),
      segment.easing,
    );
    const viewportY = segment.fromY + (segment.toY - segment.fromY) * progress;
    return segmentScrollTop(cameraPath, viewportY, metrics);
  }

  const keyframes = cameraPath.keyframes;
  if (keyframes.length === 0) return metrics.currentScrollTop;
  if (keyframes.length === 1 || timeMs <= keyframes[0].timeMs) {
    return keyframeScrollTop(cameraPath, keyframes[0], metrics);
  }
  const last = keyframes[keyframes.length - 1];
  if (timeMs >= last.timeMs) {
    return keyframeScrollTop(cameraPath, last, metrics);
  }

  let low = 0;
  let high = keyframes.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const current = keyframes[mid];
    const next = keyframes[mid + 1];
    if (!next || (timeMs >= current.timeMs && timeMs < next.timeMs)) {
      const segmentStart = current.timeMs;
      const segmentEnd = next?.timeMs ?? current.timeMs;
      const segmentDuration = segmentEnd - segmentStart;
      if (segmentDuration <= 0 || !next) {
        return keyframeScrollTop(cameraPath, current, metrics);
      }

      const elapsed = timeMs - segmentStart;
      if (elapsed < current.holdBeforeMs) {
        return keyframeScrollTop(cameraPath, current, metrics);
      }
      if (elapsed > segmentDuration - current.holdAfterMs) {
        return keyframeScrollTop(cameraPath, next, metrics);
      }

      const animStart = segmentStart + current.holdBeforeMs;
      const animEnd = segmentEnd - current.holdAfterMs;
      const progress = Math.min(1, Math.max(0, (timeMs - animStart) / (animEnd - animStart)));
      const from = keyframeScrollTop(cameraPath, current, metrics);
      const to = keyframeScrollTop(cameraPath, next, metrics);
      return from + (to - from) * progress;
    }

    if (timeMs < current.timeMs) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return keyframeScrollTop(cameraPath, keyframes[0], metrics);
}

export function getAudioCueSchedule(
  timelineIndex: PlaybackTimelineIndex,
  timeStartMs: number,
  lookaheadMs = Number.POSITIVE_INFINITY,
): AudioCueScheduleItem[] {
  const windowEndMs = timeStartMs + lookaheadMs;
  return timelineIndex.audioCues.flatMap((cue): AudioCueScheduleItem[] => {
    const cueEndMs = cue.endMs;
    if (cue.durationMs <= 0 || cueEndMs <= timeStartMs) return [];
    if (cue.startMs > windowEndMs) return [];

    const offsetMs = Math.max(0, timeStartMs - cue.startMs);
    const playDurationMs = cue.durationMs - offsetMs;
    if (playDurationMs <= 0) return [];

    return [
      {
        cue,
        delayMs: Math.max(0, cue.startMs - timeStartMs),
        offsetMs,
        playDurationMs,
      },
    ];
  });
}
