export type VisualClipEffectId = 'fadeIn' | 'fadeOut' | 'zoom' | 'shake' | 'spark';
export type VisualClipMediaType = 'image' | 'video';

export type VisualClip = {
    id: string;
    canvasId?: number;
    canvasMediaId?: number;
    index?: number;
    mediaId: number;
    mediaDuration?: number;
    hasTimelineControls?: boolean;
    sourceStart?: number;
    sourceEnd?: number;
    volume?: number;
    isMuted?: boolean;
    kind: 'cut' | 'video';
    start: number;
    duration: number;
    label: string;
    description: string;
    background: string;
    mediaUrl?: string;
    mediaType?: VisualClipMediaType;
    effects?: VisualClipEffectId[];
    bubble?: {
        text: string;
        tone?: 'default' | 'right' | 'narration';
    };
    subtitle?: string;
};

export type CanvasVisualClipMediaItem = {
    canvasMediaId?: number;
    mediaId: number;
    mediaName?: string;
    mediaType?: string;
    mediaUrl?: string;
    duration?: number;
    index?: number;
    startTime?: number;
    endTime?: number;
    sourceStartTime?: number;
    sourceEndTime?: number;
    volume?: number;
    isMuted?: boolean;
};

export type CanvasVisualClipItem = {
    id: number;
    canvasMediaId?: number;
    mediaId?: number;
    mediaName?: string;
    mediaType?: string;
    mediaUrl?: string;
    duration?: number;
    index?: number;
    startTime?: number;
    endTime?: number;
    sourceStartTime?: number;
    sourceEndTime?: number;
    volume?: number;
    isMuted?: boolean;
    medias?: CanvasVisualClipMediaItem[];
};

export const MIN_TIMELINE_ITEM_DURATION_SECONDS = 0.5;
export const CANVAS_MEDIA_SEQUENCE_UNIT_SECONDS = 1;

export const visualClipBackgrounds = [
    'linear-gradient(160deg,#22304f,#111827 62%,#263c2f)',
    'linear-gradient(160deg,#453456,#171421 62%,#3f2533)',
    'linear-gradient(160deg,#314f48,#0d1d1d 64%,#5d5430)',
    'linear-gradient(135deg,#67503a,#1a1410 60%,#423531)',
    'linear-gradient(150deg,#233d5f,#0f172a 65%,#182c3b)',
    'linear-gradient(160deg,#583c3c,#1f1616 60%,#604b2e)',
];

function toCanvasMediaSeconds(milliseconds: number | undefined) {
    return typeof milliseconds === 'number' && Number.isFinite(milliseconds) ? milliseconds / 1000 : undefined;
}

export function getCanvasMediaClipDurationSeconds(item: { mediaType: VisualClipMediaType; duration?: number }) {
    if (item.mediaType === 'video' && typeof item.duration === 'number' && Number.isFinite(item.duration) && item.duration > 0) {
        return item.duration / 1000;
    }

    return CANVAS_MEDIA_SEQUENCE_UNIT_SECONDS;
}

export function toVisualClips(items: CanvasVisualClipItem[]): VisualClip[] {
    const visualItems: Array<{
        canvasId: number;
        canvasMediaId?: number;
        clipId: string;
        mediaId: number;
        mediaName?: string;
        mediaType: VisualClipMediaType;
        mediaUrl: string;
        duration?: number;
        index?: number;
        startTime?: number;
        endTime?: number;
        sourceStartTime?: number;
        sourceEndTime?: number;
        volume?: number;
        isMuted?: boolean;
    }> = [];

    items.forEach((item) => {
        const medias =
            item.medias && item.medias.length > 0
                ? item.medias
                : [
                      {
                          canvasMediaId: item.canvasMediaId,
                          mediaId: item.mediaId,
                          mediaName: item.mediaName,
                          mediaType: item.mediaType,
                          mediaUrl: item.mediaUrl,
                          duration: item.duration,
                          index: item.index,
                          startTime: item.startTime,
                          endTime: item.endTime,
                          sourceStartTime: item.sourceStartTime,
                          sourceEndTime: item.sourceEndTime,
                          volume: item.volume,
                          isMuted: item.isMuted,
                      },
                  ];

        medias.forEach((media) => {
            if (
                typeof media.mediaId !== 'number' ||
                typeof media.mediaUrl !== 'string' ||
                (media.mediaType !== 'image' && media.mediaType !== 'video')
            ) {
                return;
            }

            visualItems.push({
                canvasId: item.id,
                canvasMediaId: media.canvasMediaId,
                clipId:
                    item.medias && item.medias.length > 1
                        ? `canvas-${item.id}-media-${media.mediaId}`
                        : `canvas-${item.id}`,
                mediaId: media.mediaId,
                mediaName: media.mediaName,
                mediaType: media.mediaType,
                mediaUrl: media.mediaUrl,
                duration: media.duration,
                index: media.index,
                startTime: media.startTime,
                endTime: media.endTime,
                sourceStartTime: media.sourceStartTime,
                sourceEndTime: media.sourceEndTime,
                volume: media.volume,
                isMuted: media.isMuted,
            });
        });
    });

    visualItems.sort(
        (a, b) =>
            (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER) ||
            a.canvasId - b.canvasId ||
            a.mediaId - b.mediaId,
    );

    let nextStart = 0;

    return visualItems.map((item, index) => {
        const explicitStart = toCanvasMediaSeconds(item.startTime);
        const explicitEnd = toCanvasMediaSeconds(item.endTime);
        const hasTimelineControls =
            item.mediaType === 'video' &&
            typeof explicitStart === 'number' &&
            typeof explicitEnd === 'number' &&
            explicitEnd > explicitStart;
        const duration = hasTimelineControls
            ? Math.max(MIN_TIMELINE_ITEM_DURATION_SECONDS, explicitEnd - explicitStart)
            : getCanvasMediaClipDurationSeconds(item);
        const start = hasTimelineControls ? explicitStart : nextStart;
        const clip = {
            id: item.clipId,
            canvasId: item.canvasId,
            canvasMediaId: item.canvasMediaId,
            index: item.index,
            mediaId: item.mediaId,
            mediaDuration: item.duration,
            hasTimelineControls,
            sourceStart: toCanvasMediaSeconds(item.sourceStartTime),
            sourceEnd: toCanvasMediaSeconds(item.sourceEndTime),
            volume: item.volume,
            isMuted: item.isMuted,
            kind: item.mediaType === 'video' ? 'video' : 'cut',
            start: Number(start.toFixed(2)),
            duration: Number(duration.toFixed(2)),
            label: item.mediaName?.trim() || `${item.mediaType === 'video' ? '영상' : '이미지'} ${String(index + 1).padStart(2, '0')}`,
            description: item.mediaType === 'video' ? '스트립에 등록된 영상 미디어' : '스트립에 등록된 이미지 미디어',
            background: visualClipBackgrounds[index % visualClipBackgrounds.length],
            mediaUrl: item.mediaUrl,
            mediaType: item.mediaType,
        } satisfies VisualClip;

        nextStart = Math.max(nextStart, start + duration);
        return clip;
    });
}

export function removeVisualClipFromCanvas(clips: VisualClip[], clipId: string, canvasId: number): VisualClip[] {
    if (!clips.some((clip) => clip.id === clipId && clip.canvasId === canvasId)) {
        return clips;
    }

    let nextStart = 0;

    return clips.flatMap((clip) => {
        if (clip.canvasId !== canvasId) {
            return [clip];
        }
        if (clip.id === clipId) {
            return [];
        }

        const duration = Math.max(1, Number(clip.duration.toFixed(2)));
        const nextClip = {
            ...clip,
            start: Number(nextStart.toFixed(2)),
            duration,
        };

        nextStart += duration;
        return [nextClip];
    });
}
