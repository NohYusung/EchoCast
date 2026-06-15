import type { PlayerManifest, PlayerManifestItem } from './playerManifest.types';
import { filterPreviewCanvasItems, resolvePreviewCanvasId } from './previewCanvasSelection';
import { toVisualClips, type VisualClip } from './visualClips';

const DEFAULT_SCENE_HEIGHT = 620;
const PLAYER_CONTENT_WIDTH = 720;

type PlayerSceneKind = 'image' | 'video' | 'placeholder';

export type PlayerScene = {
    id: string;
    kind: PlayerSceneKind;
    label: string;
    startTime: number;
    endTime: number;
    canvasId?: string | number;
    index?: number;
    mediaUrl?: string;
    mediaId?: string;
    mediaDuration?: number;
    trimStartTime?: number;
    trimEndTime?: number;
    hasTimelineControls?: boolean;
    isMuted?: boolean;
    volume?: number;
    height: number;
    background: string;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function getItemDuration(item: PlayerManifestItem) {
    return Math.max(1, item.endTime - item.startTime);
}

function getSceneHeight(item: PlayerManifestItem, media: PlayerManifest['media'][number] | undefined) {
    if (media?.kind === 'image') return 0;

    if (media?.naturalWidth && media.naturalHeight) {
        return clamp(Math.round((media.naturalHeight / Math.max(1, media.naturalWidth)) * PLAYER_CONTENT_WIDTH), 360, 1400);
    }

    if (media?.kind === 'video') return 520;

    return clamp(Math.round(getItemDuration(item) / 1000) * 160, 420, 1100);
}

export function shouldDriveStripScrollFromScenes(scenes: PlayerScene[]) {
    if (scenes.length <= 1) return false;

    const [first] = scenes;
    return scenes.some((scene) => scene.startTime !== first.startTime || scene.endTime !== first.endTime);
}

export function buildPlayerScenes(manifest: PlayerManifest): PlayerScene[] {
    const canvasScenes = buildCanvasPreviewScenes(manifest);
    if (canvasScenes.length > 0) {
        return canvasScenes;
    }

    const mediaById = new Map(manifest.media.map((media) => [media.id, media]));
    const visualItems = manifest.items
        .filter((item) => item.kind === 'visual')
        .sort((a, b) => a.startTime - b.startTime || a.layerId - b.layerId || a.id.localeCompare(b.id));
    const sourceItems =
        visualItems.length > 0
            ? visualItems
            : manifest.cues
                  .slice()
                  .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id))
                  .map<PlayerManifestItem>((cue) => ({
                      id: `cue-scene-${cue.id}`,
                      trackId: cue.trackId,
                      kind: 'visual',
                      startTime: cue.startTime,
                      endTime: cue.endTime,
                      cueId: cue.id,
                      layerId: 0,
                      volume: cue.volume,
                  }));

    if (sourceItems.length === 0) {
        return [
            {
                id: 'empty-scene',
                kind: 'placeholder',
                label: 'EMPTY',
                startTime: 0,
                endTime: Math.max(1000, manifest.durationMs),
                volume: 1,
                height: DEFAULT_SCENE_HEIGHT,
                background: 'linear-gradient(180deg, #161b24 0%, #0d1117 100%)',
            },
        ];
    }

    return sourceItems.map((item, index) => {
        const media = item.mediaId ? mediaById.get(item.mediaId) : undefined;
        const kind: PlayerSceneKind = media?.kind === 'image' || media?.kind === 'video' ? media.kind : 'placeholder';

        return {
            id: item.id,
            kind,
            label: kind === 'placeholder' ? `SCENE ${String(index + 1).padStart(2, '0')}` : `CUT ${String(index + 1).padStart(2, '0')}`,
            startTime: item.startTime,
            endTime: item.endTime,
            canvasId: item.canvasId,
            index: item.index ?? index,
            mediaUrl: media?.url,
            mediaId: item.mediaId,
            mediaDuration: media?.durationMs,
            trimStartTime: item.trimStartTime,
            trimEndTime: item.trimEndTime,
            hasTimelineControls: item.hasTimelineControls,
            isMuted: item.isMuted,
            volume: item.volume,
            height: getSceneHeight(item, media),
            background: `linear-gradient(160deg, hsl(${(index * 43) % 360} 34% 25%), #111827)`,
        };
    });
}

function getSceneHeightFromVisualClip(clip: VisualClip) {
    if (clip.mediaType === 'image') return 0;
    if (clip.mediaType === 'video') return 520;

    return DEFAULT_SCENE_HEIGHT;
}

function buildCanvasPreviewScenes(manifest: PlayerManifest): PlayerScene[] {
    if (!manifest.canvases || manifest.canvases.length === 0) {
        return [];
    }

    const selectedCanvasId = resolvePreviewCanvasId(manifest.canvases, manifest.previewCanvasId);
    const visualClips = filterPreviewCanvasItems(toVisualClips(manifest.canvases), selectedCanvasId);

    return visualClips.map((clip, index) => {
        const kind: PlayerSceneKind = clip.mediaType === 'video' ? 'video' : clip.mediaType === 'image' ? 'image' : 'placeholder';
        const startTime = Math.round(clip.start * 1000);
        const endTime = Math.round((clip.start + clip.duration) * 1000);

        return {
            id: clip.id,
            kind,
            label: clip.label || (kind === 'placeholder' ? `SCENE ${String(index + 1).padStart(2, '0')}` : `CUT ${String(index + 1).padStart(2, '0')}`),
            startTime,
            endTime,
            canvasId: clip.canvasId,
            index: clip.index ?? index,
            mediaUrl: clip.mediaUrl,
            mediaId: String(clip.mediaId),
            mediaDuration: clip.mediaDuration,
            trimStartTime: typeof clip.sourceStart === 'number' ? Math.round(clip.sourceStart * 1000) : undefined,
            trimEndTime: typeof clip.sourceEnd === 'number' ? Math.round(clip.sourceEnd * 1000) : undefined,
            hasTimelineControls: clip.hasTimelineControls,
            isMuted: clip.isMuted,
            volume: clip.volume,
            height: getSceneHeightFromVisualClip(clip),
            background: clip.background,
        };
    });
}
