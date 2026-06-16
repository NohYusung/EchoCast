import { Injectable, NotFoundException } from '@nestjs/common';
import { checkInValue } from '../../../libs/utils/typeorm';
import { DddService } from '../../../libs/ddd';
import { AnchorRepository } from '../../anchors/repository/anchor.repository';
import { AudioRepository } from '../../audios/repository/audio.repository';
import type { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import type { Canvas } from '../../canvases/domain/canvas.entity';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import { CharacterRepository } from '../../characters/repository/characater.repository';
import type { Cue } from '../../cues/domain/cue.entity';
import { CueRepository } from '../../cues/repository/cue.repository';
import { EpisodeRepository } from '../../episodes/repository/episode.repository';
import { Record as RecordEntity } from '../../records/domain/record.entity';
import { RecordRepository } from '../../records/repository/record.repository';
import { ScrollRepository } from '../../scrolls/repository/scroll.repository';
import { TrackRepository } from '../../tracks/repository/track.repository';
const MIN_TIMELINE_ITEM_DURATION_MS = 500;
const CANVAS_MEDIA_SEQUENCE_UNIT_MS = 1000;
const VIRTUAL_VISUAL_TRACK_ID = 0;

function hasAssignedCueTime(cue: Cue): cue is Cue & { startTime: number; endTime: number } {
    return typeof cue.startTime === 'number' && typeof cue.endTime === 'number';
}

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
            (a, b) =>
                (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER) || a.media.id - b.media.id
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

@Injectable()
export class PlayerService extends DddService {
    constructor(
        private readonly episodeRepository: EpisodeRepository,
        private readonly characterRepository: CharacterRepository,
        private readonly trackRepository: TrackRepository,
        private readonly canvasRepository: CanvasRepository,
        private readonly cueRepository: CueRepository,
        private readonly audioRepository: AudioRepository,
        private readonly anchorRepository: AnchorRepository,
        private readonly scrollRepository: ScrollRepository,
        private readonly recordRepository: RecordRepository
    ) {
        super();
    }

    async getDraft({ episodeId }: { episodeId: number }) {
        const [episode] = await this.episodeRepository.find({ id: episodeId }, { relations: { product: true } });
        if (!episode) {
            throw new NotFoundException('에피소드를 찾을 수 없습니다.');
        }

        const [characters, tracks, canvases, audios] = await Promise.all([
            this.characterRepository.find({ productId: episode.productId }, { options: { sort: 'id', order: 'ASC' } }),
            this.trackRepository.find({ episodeId }, { options: { sort: 'id', order: 'ASC' } }),
            this.canvasRepository.find({ episodeId }, { relations: { canvasMedias: { media: true } } }),
            this.audioRepository.find({ episodeId }, { options: { sort: 'id', order: 'ASC' } }),
        ]);
        canvases.forEach((canvas) => {
            canvas.canvasMedias = [...canvas.canvasMedias].sort(
                (a, b) =>
                    (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER) ||
                    a.media.id - b.media.id
            );
        });
        canvases.sort((a, b) => {
            const [aCanvasMedia] = a.canvasMedias;
            const [bCanvasMedia] = b.canvasMedias;

            return (
                (aCanvasMedia?.index ?? Number.MAX_SAFE_INTEGER) - (bCanvasMedia?.index ?? Number.MAX_SAFE_INTEGER) ||
                a.id - b.id
            );
        });
        const visualMediaItems = canvases
            .flatMap((canvas) =>
                canvas.canvasMedias.map((canvasMedia) => ({
                    canvas,
                    canvasMedia,
                    media: canvasMedia.media,
                }))
            )
            .sort(
                (a, b) =>
                    (a.canvasMedia.index ?? Number.MAX_SAFE_INTEGER) -
                        (b.canvasMedia.index ?? Number.MAX_SAFE_INTEGER) ||
                    a.canvas.id - b.canvas.id ||
                    a.media.id - b.media.id
            );
        const playerCanvases = toPlayerCanvases(canvases);
        const previewVisualTimings = getPreviewVisualTimingItems(visualMediaItems);
        const trackIds = tracks.map((track) => track.id);
        const [cues, anchors, scrolls] =
            trackIds.length > 0
                ? await Promise.all([
                      this.cueRepository.find(
                          { trackId: checkInValue(trackIds) },
                          { options: { sort: 'startTime', order: 'ASC' } }
                      ),
                      this.anchorRepository.find(
                          { trackId: checkInValue(trackIds) },
                          { options: { sort: 'time', order: 'ASC' } }
                      ),
                      this.scrollRepository.find(
                          { trackId: checkInValue(trackIds) },
                          { relations: { startAnchor: true, endAnchor: true } }
                      ),
                  ])
                : [[], [], []];
        cues.sort(
            (a, b) => (a.startTime ?? Number.MAX_SAFE_INTEGER) - (b.startTime ?? Number.MAX_SAFE_INTEGER) || a.id - b.id
        );
        anchors.sort((a, b) => a.time - b.time || a.id - b.id);
        scrolls.sort((a, b) => (a.startAnchor?.time ?? 0) - (b.startAnchor?.time ?? 0) || a.id - b.id);
        const scheduledCues = cues.filter(hasAssignedCueTime);
        const cueIds = scheduledCues.map((cue) => cue.id);
        const records: RecordEntity[] =
            cueIds.length > 0
                ? await this.recordRepository.find(
                      { cueId: checkInValue(cueIds) },
                      { options: { sort: 'cueId', order: 'ASC' } }
                  )
                : [];
        records.sort((a, b) => a.cueId - b.cueId || a.id - b.id);
        const scripts = scheduledCues.map((cue, index) => ({
            id: cue.id,
            episodeId: episode.id,
            characterId: cue.characterId ?? 0,
            text: cue.script,
            sortOrder: index + 1,
        }));

        const initialTracksDraft = tracks.map((track) => ({
            id: track.id,
            episodeId: episode.id,
            name: track.name,
            kind: track.type,
            layerId: 0,
            isMuted: track.isMuted,
        }));
        const visualTrack = initialTracksDraft.find((track) => track.kind === 'scroll' || track.kind === 'scrolls');
        const tracksDraft = (
            visualTrack
                ? [visualTrack, ...initialTracksDraft.filter((track) => track.id !== visualTrack.id)]
                : initialTracksDraft
        ).map((track, index) => ({
            ...track,
            layerId: index,
        }));
        const layerIdByTrackId = new Map(tracksDraft.map((track) => [track.id, track.layerId]));
        const trackKindById = new Map(tracksDraft.map((track) => [track.id, track.kind]));
        const visualTrackId = visualTrack?.id ?? VIRTUAL_VISUAL_TRACK_ID;
        const visualLayerId = layerIdByTrackId.get(visualTrackId) ?? 0;

        return {
            products: [
                {
                    id: episode.product.id,
                    title: episode.product.title,
                    coverImageUrl: episode.product.coverImageUrl ?? undefined,
                },
            ],
            episodes: [
                {
                    id: episode.id,
                    productId: episode.productId,
                    episodeNumber: episode.episodeNumber,
                    title: episode.title,
                    subTitle: episode.subTitle,
                },
            ],
            characters: characters.map((character) => ({
                id: character.id,
                name: character.name,
                color: '#64748b',
            })),
            scripts,
            tracks: tracksDraft,
            canvases: playerCanvases,
            items: [
                ...visualMediaItems.map(({ canvas, canvasMedia, media }, index) => {
                    const mediaIndex = canvasMedia.index ?? index;
                    const timing = previewVisualTimings[index] ?? {
                        startTime: 0,
                        endTime: CANVAS_MEDIA_SEQUENCE_UNIT_MS,
                        hasTimelineControls: false,
                    };

                    return {
                        id: canvasMedia.id,
                        trackId: visualTrackId,
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
                        trimEndTime:
                            typeof canvasMedia.sourceEndTime === 'number' ? canvasMedia.sourceEndTime : undefined,
                        hasTimelineControls: timing.hasTimelineControls,
                        isMuted: canvasMedia.isMuted === true,
                        volume: canvasMedia.isMuted ? 0 : canvasMedia.volume,
                    };
                }),
                ...scheduledCues.map((cue) => ({
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
                    volume: cue.volume,
                })),
            ].sort((a, b) => a.startTime - b.startTime || a.layerId - b.layerId || a.id - b.id),
            media: [
                ...canvases.flatMap((canvas) =>
                    canvas.canvasMedias.map((canvasMedia) => ({
                        id: canvasMedia.media.id,
                        episodeId: episode.id,
                        kind: canvasMedia.media.mediaType,
                        url: canvasMedia.media.mediaUrl,
                        ...(typeof canvasMedia.media.duration === 'number'
                            ? { durationMs: canvasMedia.media.duration }
                            : {}),
                    }))
                ),
                ...audios.map((audio) => ({
                    id: audio.id,
                    episodeId: episode.id,
                    kind: audio.audioType === 'effect' ? ('effect' as const) : ('audio' as const),
                    url: audio.audioUrl,
                    durationMs: audio.duration,
                })),
            ],
            cues: scheduledCues.map((cue) => ({
                id: cue.id,
                episodeId: episode.id,
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
                ttsUrl: undefined as string | undefined,
                volume: cue.volume,
            })),
            scrolls: scrolls.map((scroll) => ({
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
            })),
            anchors: anchors.map((anchor) => ({
                id: anchor.id,
                trackId: anchor.trackId,
                canvasId: anchor.canvasId,
                time: anchor.time,
                position: anchor.position,
                index: anchor.index,
            })),
            records: records.map((record) => ({
                id: record.id,
                cueId: record.cueId,
                artistId: record.artistId,
                recordUrl: record.recordUrl,
                duration: record.duration ?? undefined,
                volume: record.volume,
                isAccepted: record.isAccepted,
            })),
            screenEffects: [],
        };
    }

    async getManifest({ episodeId }: { episodeId: number }) {
        return this.toManifest(await this.getDraft({ episodeId }));
    }

    toManifest(draft: Awaited<ReturnType<PlayerService['getDraft']>>) {
        const acceptedRecordByCueId = new Map<number, (typeof draft.records)[number]>();
        for (const record of draft.records) {
            if (record.isAccepted) {
                acceptedRecordByCueId.set(record.cueId, record);
            }
        }
        const cues = draft.cues.map((cue) => ({
            id: cue.id,
            scriptId: cue.scriptId,
            characterId: cue.characterId,
            trackId: cue.trackId,
            audioId: cue.audioId,
            startCanvasMediaId: cue.startCanvasMediaId,
            endCanvasMediaId: cue.endCanvasMediaId,
            startTime: cue.startTime,
            endTime: cue.endTime,
            audioStartTime: cue.audioStartTime,
            audioEndTime: cue.audioEndTime,
            startPosition: cue.startPosition,
            endPosition: cue.endPosition,
            approvedRecordUrl: acceptedRecordByCueId.get(cue.id)?.recordUrl,
            ttsUrl: cue.ttsUrl,
            volume: cue.volume,
        }));
        const durationMs = Math.max(
            0,
            ...draft.items.map((item) => item.endTime),
            ...draft.cues.map((cue) => cue.endTime),
            ...draft.scrolls.map((scroll) => scroll.endTime),
            ...draft.anchors.map((anchor) => anchor.time),
            ...draft.cues.map((cue) => {
                const record = acceptedRecordByCueId.get(cue.id);
                return record ? cue.startTime + (record.duration ?? cue.endTime - cue.startTime) : 0;
            })
        );

        return {
            episodeId: draft.episodes[0]?.id ?? 0,
            durationMs,
            previewCanvasId: draft.canvases[0]?.id,
            tracks: draft.tracks.map(({ episodeId: _episodeId, ...track }) => track),
            items: draft.items.map((item) => ({
                ...item,
                volume: item.volume ?? 1,
            })),
            cues,
            canvases: draft.canvases,
            media: draft.media.map(({ episodeId: _episodeId, ...media }) => media),
            records: draft.records,
            scrolls: draft.scrolls,
            anchors: draft.anchors,
            tts: [],
        };
    }
}
