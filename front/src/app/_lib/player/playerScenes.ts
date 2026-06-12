import type { PlayerManifest, PlayerManifestItem } from './playerManifest.types';

const DEFAULT_SCENE_HEIGHT = 620;
const PLAYER_CONTENT_WIDTH = 720;

type PlayerSceneKind = 'image' | 'video' | 'placeholder';

export type PlayerScene = {
    id: string;
    kind: PlayerSceneKind;
    label: string;
    startTime: number;
    endTime: number;
    mediaUrl?: string;
    mediaId?: string;
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
            mediaUrl: media?.url,
            mediaId: item.mediaId,
            height: getSceneHeight(item, media),
            background: `linear-gradient(160deg, hsl(${(index * 43) % 360} 34% 25%), #111827)`,
        };
    });
}
