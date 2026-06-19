import type { Anchor } from '../../../anchors/domain/anchor.entity';
import type { Audio } from '../../../audios/domain/audio.entity';
import type { CanvasMedia } from '../../../canvas-medias/domain/canvas-media.entity';
import type { Canvas } from '../../../canvases/domain/canvas.entity';
import type { Cue } from '../../../cues/domain/cue.entity';
import type { Episode } from '../../../episodes/domain/episode.entity';
import type { Record as RecordEntity } from '../../../records/domain/record.entity';
import type { Scroll } from '../../../scrolls/domain/scroll.entity';
import type { Track } from '../../../tracks/domain/track.entity';

const MIN_TIMELINE_ITEM_DURATION_MS = 500;
const CANVAS_MEDIA_SEQUENCE_UNIT_MS = 1000;

export type AssignedCue = Cue & { startTime: number; endTime: number };

function toPlayerCanvasMediaTimelineControls(canvasMedia: CanvasMedia | undefined) {
    if (!canvasMedia) {
        return {};
    }

    return {
        ...(typeof canvasMedia.startTime === 'number' ? { startTime: canvasMedia.startTime } : {}),
        ...(typeof canvasMedia.endTime === 'number' ? { endTime: canvasMedia.endTime } : {}),
        ...(typeof canvasMedia.sourceStartTime === 'number' ? { sourceStartTime: canvasMedia.sourceStartTime } : {}),
        ...(typeof canvasMedia.sourceEndTime === 'number' ? { sourceEndTime: canvasMedia.sourceEndTime } : {}),
        ...(typeof canvasMedia.volume === 'number' ? { volume: canvasMedia.volume } : {}),
        ...(typeof canvasMedia.isMuted === 'boolean' ? { isMuted: canvasMedia.isMuted } : {}),
    };
}

function toPlayerCanvases(canvases: Canvas[]) {
    return canvases.map((canvas) => {
        const canvasMedias = [...canvas.canvasMedias].sort(
            (a, b) => a.index! - b.index! || a.media.id - b.media.id
        );
        const [canvasMedia] = canvasMedias;
        const media = canvasMedia?.media;

        return {
            id: canvas.id,
            episodeId: canvas.episodeId,
            mediaId: media?.id,
            mediaName: media?.mediaName,
            mediaType: media?.mediaType,
            mediaUrl: media?.mediaUrl,
            ...(typeof media?.duration === 'number' ? { duration: media.duration } : {}),
            canvasMediaId: canvasMedia?.id,
            index: canvasMedia?.index,
            ...toPlayerCanvasMediaTimelineControls(canvasMedia),
            medias: canvasMedias.map((canvasMediaItem) => ({
                canvasMediaId: canvasMediaItem.id,
                mediaId: canvasMediaItem.media.id,
                mediaName: canvasMediaItem.media.mediaName,
                mediaType: canvasMediaItem.media.mediaType,
                mediaUrl: canvasMediaItem.media.mediaUrl,
                ...(typeof canvasMediaItem.media.duration === 'number'
                    ? { duration: canvasMediaItem.media.duration }
                    : {}),
                index: canvasMediaItem.index,
                ...toPlayerCanvasMediaTimelineControls(canvasMediaItem),
            })),
        };
    });
}

function getPreviewVisualTimingItems(
    visualMediaItems: Array<{ canvasMedia: CanvasMedia; media: CanvasMedia['media'] }>
) {
    let nextStartTime = 0;

    return visualMediaItems.map(({ canvasMedia, media }) => {
        const hasTimelineControls =
            media.mediaType === 'video' &&
            typeof canvasMedia.startTime === 'number' &&
            typeof canvasMedia.endTime === 'number' &&
            canvasMedia.endTime > canvasMedia.startTime;
        const duration = hasTimelineControls
            ? Math.max(MIN_TIMELINE_ITEM_DURATION_MS, canvasMedia.endTime! - canvasMedia.startTime!)
            : media.mediaType === 'video' &&
                typeof media.duration === 'number' &&
                Number.isFinite(media.duration) &&
                media.duration > 0
              ? media.duration
              : CANVAS_MEDIA_SEQUENCE_UNIT_MS;
        const startTime = hasTimelineControls ? canvasMedia.startTime! : nextStartTime;
        const endTime = startTime + duration;

        nextStartTime = Math.max(nextStartTime, endTime);

        return {
            startTime,
            endTime,
            hasTimelineControls,
        };
    });
}

export class PlayerInfoResponseDto {
    static from({
        episode,
        tracks,
        canvas,
        cues,
        audios,
        anchors,
        scrolls,
        records,
    }: {
        episode: Episode & { product: Episode['product'] };
        tracks: Track[];
        canvas: Canvas;
        cues: AssignedCue[];
        audios: Audio[];
        anchors: Anchor[];
        scrolls: Scroll[];
        records: RecordEntity[];
    }) {
        const visualMediaItems = canvas.canvasMedias.map((canvasMedia) => ({
            canvas,
            canvasMedia,
            media: canvasMedia.media,
        }));
        const playerCanvases = toPlayerCanvases([canvas]);
        const previewVisualTimings = getPreviewVisualTimingItems(visualMediaItems);
        const selectedAnchors = anchors.filter((anchor) => anchor.canvasId === canvas.id);
        const selectedScrolls = scrolls.filter(
            (scroll) => scroll.startAnchor?.canvasId === canvas.id || scroll.endAnchor?.canvasId === canvas.id
        );
        const responseTracks = tracks.map((track, index) => ({
            id: track.id,
            name: track.name,
            kind: track.type,
            layerId: index,
            isMuted: track.isMuted,
        }));
        const visualTrack = responseTracks.find((track) => track.kind === 'scroll' || track.kind === 'scrolls');
        const orderedTracks = visualTrack
            ? [visualTrack, ...responseTracks.filter((track) => track.id !== visualTrack.id)].map((track, index) => ({
                  ...track,
                  layerId: index,
              }))
            : responseTracks;
        const layerIdByTrackId = new Map(orderedTracks.map((track) => [track.id, track.layerId]));
        const trackKindById = new Map(orderedTracks.map((track) => [track.id, track.kind]));
        const visualLayerId = typeof visualTrack?.id === 'number' ? (layerIdByTrackId.get(visualTrack.id) ?? 0) : 0;
        const items = [
            ...visualMediaItems.map(({ canvas, canvasMedia, media }, index) => {
                const mediaIndex = canvasMedia.index!;
                const timing = previewVisualTimings[index] ?? {
                    startTime: 0,
                    endTime: CANVAS_MEDIA_SEQUENCE_UNIT_MS,
                    hasTimelineControls: false,
                };

                return {
                    id: canvasMedia.id,
                    ...(typeof visualTrack?.id === 'number' ? { trackId: visualTrack.id } : {}),
                    kind: 'visual' as const,
                    startTime: timing.startTime,
                    endTime: timing.endTime,
                    canvasId: canvas.id,
                    index: mediaIndex,
                    mediaId: media.id,
                    cueId: undefined as number | undefined,
                    layerId: visualLayerId,
                    trimStartTime:
                        typeof canvasMedia.sourceStartTime === 'number' ? canvasMedia.sourceStartTime : undefined,
                    trimEndTime: typeof canvasMedia.sourceEndTime === 'number' ? canvasMedia.sourceEndTime : undefined,
                    hasTimelineControls: timing.hasTimelineControls,
                    isMuted: canvasMedia.isMuted === true,
                    volume: canvasMedia.isMuted ? 0 : (canvasMedia.volume ?? 1),
                };
            }),
            ...cues.map((cue) => ({
                id: cue.id,
                trackId: cue.trackId,
                kind:
                    cue.audioId && trackKindById.get(cue.trackId) === 'effect'
                        ? ('effect' as const)
                        : cue.audioId
                          ? ('audio' as const)
                          : ('cue' as const),
                startTime: cue.startTime,
                endTime: cue.endTime,
                canvasId: undefined as number | undefined,
                index: undefined as number | undefined,
                cueId: cue.id,
                mediaId: cue.audioId ?? undefined,
                layerId: layerIdByTrackId.get(cue.trackId) ?? 1,
                trimStartTime: typeof cue.audioStartTime === 'number' ? cue.audioStartTime : undefined,
                trimEndTime: typeof cue.audioEndTime === 'number' ? cue.audioEndTime : undefined,
                hasTimelineControls: undefined as boolean | undefined,
                isMuted: undefined as boolean | undefined,
                volume: cue.volume ?? 1,
            })),
        ].sort((a, b) => a.startTime - b.startTime || a.layerId - b.layerId || a.id - b.id);
        const media = [
            ...visualMediaItems.map(({ canvasMedia }) => ({
                id: canvasMedia.media.id,
                kind: canvasMedia.media.mediaType,
                url: canvasMedia.media.mediaUrl,
                ...(typeof canvasMedia.media.duration === 'number'
                    ? { durationMs: canvasMedia.media.duration }
                    : {}),
            })),
            ...audios
                .filter((audio) => audio.audioType !== 'record')
                .map((audio) => ({
                    id: audio.id,
                    kind: audio.audioType === 'effect' ? ('effect' as const) : ('audio' as const),
                    url: audio.audioUrl,
                    durationMs: audio.duration,
                })),
        ];
        const playerRecords = records.map((record) => ({
            id: record.id,
            cueId: record.cueId,
            artistId: record.artistId,
            audioId: record.audioId,
            recordUrl: record.audio?.audioUrl,
            duration: record.audio?.duration ?? undefined,
            isAccepted: record.isAccepted,
        }));
        const acceptedRecordByCueId = new Map<number, (typeof playerRecords)[number]>();
        for (const record of playerRecords) {
            if (record.isAccepted) {
                acceptedRecordByCueId.set(record.cueId, record);
            }
        }
        const playerCues = cues.map((cue) => ({
            id: cue.id,
            scriptId: cue.id,
            characterId: cue.characterId ?? undefined,
            trackId: cue.trackId,
            audioId: cue.audioId ?? undefined,
            startCanvasMediaId: cue.startCanvasMediaId ?? undefined,
            endCanvasMediaId: cue.endCanvasMediaId ?? undefined,
            startTime: cue.startTime,
            endTime: cue.endTime,
            audioStartTime: cue.audioStartTime,
            audioEndTime: cue.audioEndTime,
            startPosition: cue.startPosition,
            endPosition: cue.endPosition,
            approvedRecordUrl: acceptedRecordByCueId.get(cue.id)?.recordUrl,
            ttsUrl: undefined as string | undefined,
            volume: cue.volume,
        }));
        const playerScrolls = selectedScrolls.map((scroll) => ({
            id: scroll.id,
            trackId: scroll.trackId,
            canvasId:
                typeof scroll.startAnchor?.canvasId === 'number'
                    ? scroll.startAnchor.canvasId
                    : typeof scroll.endAnchor?.canvasId === 'number'
                      ? scroll.endAnchor.canvasId
                      : undefined,
            startIndex: scroll.startAnchor?.index ?? 0,
            endIndex: scroll.endAnchor?.index ?? scroll.startAnchor?.index ?? 0,
            startTime: scroll.startAnchor?.time ?? 0,
            endTime: scroll.endAnchor?.time ?? scroll.startAnchor?.time ?? 0,
            startPosition: scroll.startAnchor?.position ?? 0,
            endPosition: scroll.endAnchor?.position ?? scroll.startAnchor?.position ?? 0,
        }));
        const playerAnchors = selectedAnchors.map((anchor) => ({
            id: anchor.id,
            trackId: anchor.trackId,
            canvasId: anchor.canvasId,
            time: anchor.time,
            position: anchor.position,
            index: anchor.index,
        }));
        const totalDuration = Math.max(
            0,
            ...items.map((item) => item.endTime),
            ...playerCues.map((cue) => cue.endTime),
            ...playerScrolls.map((scroll) => scroll.endTime),
            ...playerAnchors.map((anchor) => anchor.time),
            ...playerCues.map((cue) => {
                const record = acceptedRecordByCueId.get(cue.id);
                return record ? cue.startTime + (record.duration ?? cue.endTime - cue.startTime) : 0;
            })
        );

        return {
            episodeId: episode.id,
            totalDuration,
            previewCanvasId: playerCanvases[0]?.id,
            tracks: orderedTracks,
            items,
            cues: playerCues,
            canvases: playerCanvases,
            media,
            records: playerRecords,
            scrolls: playerScrolls,
            anchors: playerAnchors,
            tts: [],
        };
    }
}
