import type {
  PlaybackV2Envelope,
  StoryBeat,
  StoryStripItem,
} from "@/data/playbackV2Types";

export interface PlaybackV2DocumentEntity {
  entityName: "playback_v2_document";
  id: string;
  playerKey: string;
  schemaVersion: PlaybackV2Envelope["schemaVersion"];
  authoringSchemaVersion: PlaybackV2Envelope["authoringDocument"]["schemaVersion"];
  manifestSchemaVersion: PlaybackV2Envelope["playbackManifest"]["schemaVersion"];
}

export interface PlaybackV2StoryStripItemEntity {
  entityName: "playback_v2_story_strip_item";
  kind: "image" | "video";
  playerKey: string;
  documentId: string;
  itemId: string;
  order: number;
  source: {
    type: "image" | "youtube";
    url: string;
    embedUrl?: string;
  };
  placement?: {
    anchorImageOrder: number;
    offsetRatio: number;
  };
  layout: {
    heightUnits: number;
    aspectRatio?: string;
  };
}

export interface PlaybackV2BeatEntity {
  entityName: "playback_v2_beat";
  playerKey: string;
  documentId: string;
  beatId: string;
  sceneId: string;
  order: number;
  anchor: {
    panelId: string;
    ratioY: number;
  };
  durationPolicy: StoryBeat["durationPolicy"];
  minDurationMs: number;
  voiceLineCount: number;
  soundEffectCount: number;
  screenEffectCount: number;
  cameraIntent: StoryBeat["cameraIntent"];
}

export interface PlaybackV2ManifestEntity {
  entityName: "playback_v2_manifest";
  id: string;
  sourceDocumentId: string;
  durationMs: number;
  cameraSegmentCount: number;
  audioCueCount: number;
  visualCueCount: number;
}

export interface PlaybackV2EntitySnapshot {
  document: PlaybackV2DocumentEntity;
  storyStripItems: PlaybackV2StoryStripItemEntity[];
  beats: PlaybackV2BeatEntity[];
  playbackManifest: PlaybackV2ManifestEntity;
}

function storyStripItemEntity(params: {
  playerKey: string;
  documentId: string;
  item: StoryStripItem;
}): PlaybackV2StoryStripItemEntity {
  if (params.item.type === "image") {
    return {
      entityName: "playback_v2_story_strip_item",
      kind: "image",
      playerKey: params.playerKey,
      documentId: params.documentId,
      itemId: params.item.id,
      order: params.item.order,
      source: {
        type: "image",
        url: params.item.source.src,
      },
      layout: {
        heightUnits: params.item.layout.heightUnits,
        aspectRatio: params.item.layout.aspectRatio,
      },
    };
  }

  return {
    entityName: "playback_v2_story_strip_item",
    kind: "video",
    playerKey: params.playerKey,
    documentId: params.documentId,
    itemId: params.item.id,
    order: params.item.order,
    source: {
      type: params.item.source.provider,
      url: params.item.source.src,
      embedUrl: params.item.source.embedUrl,
    },
    placement: {
      anchorImageOrder: params.item.placement.anchorImageOrder,
      offsetRatio: params.item.placement.offsetRatio,
    },
    layout: {
      heightUnits: params.item.layout.heightUnits,
      aspectRatio: params.item.layout.aspectRatio,
    },
  };
}

function beatEntity(params: {
  playerKey: string;
  documentId: string;
  beat: StoryBeat;
}): PlaybackV2BeatEntity {
  return {
    entityName: "playback_v2_beat",
    playerKey: params.playerKey,
    documentId: params.documentId,
    beatId: params.beat.id,
    sceneId: params.beat.sceneId,
    order: params.beat.order,
    anchor: params.beat.anchor,
    durationPolicy: params.beat.durationPolicy,
    minDurationMs: params.beat.minDurationMs,
    voiceLineCount: params.beat.voiceLines.length,
    soundEffectCount: params.beat.soundEffects.length,
    screenEffectCount: params.beat.screenEffects.length,
    cameraIntent: params.beat.cameraIntent,
  };
}

export function buildPlaybackV2EntitySnapshot(
  envelope: PlaybackV2Envelope,
): PlaybackV2EntitySnapshot {
  const documentId = envelope.authoringDocument.id;
  return {
    document: {
      entityName: "playback_v2_document",
      id: documentId,
      playerKey: envelope.playerKey,
      schemaVersion: envelope.schemaVersion,
      authoringSchemaVersion: envelope.authoringDocument.schemaVersion,
      manifestSchemaVersion: envelope.playbackManifest.schemaVersion,
    },
    storyStripItems: envelope.authoringDocument.storyStrip.items.map((item) =>
      storyStripItemEntity({
        playerKey: envelope.playerKey,
        documentId,
        item,
      }),
    ),
    beats: envelope.authoringDocument.beats.map((beat) =>
      beatEntity({
        playerKey: envelope.playerKey,
        documentId,
        beat,
      }),
    ),
    playbackManifest: {
      entityName: "playback_v2_manifest",
      id: envelope.playbackManifest.id,
      sourceDocumentId: envelope.playbackManifest.sourceDocumentId,
      durationMs: envelope.playbackManifest.durationMs,
      cameraSegmentCount: envelope.playbackManifest.cameraPath.segments.length,
      audioCueCount: envelope.playbackManifest.audioCues.length,
      visualCueCount: envelope.playbackManifest.visualCues.length,
    },
  };
}
