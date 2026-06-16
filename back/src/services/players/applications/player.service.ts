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
import type { TrackType } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
type PlayerTrackKind = 'visual' | 'dialogue' | 'audio' | 'effect';
const MIN_TIMELINE_ITEM_DURATION_MS = 500;
const CANVAS_MEDIA_SEQUENCE_UNIT_MS = 1000;

/*
AGENT
- 타입을 따로 빼서 관리하지 않음. 
- 호출부에서 객체 형태로 바로 사용해. 
*/
type PlayerItem = {
    id: string;
    trackId: string;
    kind: 'visual' | 'audio' | 'effect' | 'cue';
    startTime: number;
    endTime: number;
    canvasId?: string;
    index?: number;
    mediaId?: string;
    cueId?: string;
    layerId: number;
    trimStartTime?: number;
    trimEndTime?: number;
    hasTimelineControls?: boolean;
    isMuted?: boolean;
    volume?: number;
};

/*
AGENT
- 타입을 따로 빼서 관리하지 않음.
- 호출부에서 객체 형태로 바로 사용해.
*/
type PlayerCanvas = {
    id: number;
    episodeId: number;
    mediaId?: number;
    mediaName?: string;
    mediaType?: 'image' | 'video' | 'audio';
    mediaUrl?: string;
    duration?: number;
    canvasMediaId?: number;
    index?: number;
    startTime?: number;
    endTime?: number;
    sourceStartTime?: number;
    sourceEndTime?: number;
    volume?: number;
    isMuted?: boolean;
    medias: Array<{
        canvasMediaId: number;
        mediaId: number;
        mediaName: string;
        mediaType: 'image' | 'video' | 'audio';
        mediaUrl: string;
        duration?: number;
        index?: number;
        startTime?: number;
        endTime?: number;
        sourceStartTime?: number;
        sourceEndTime?: number;
        volume?: number;
        isMuted?: boolean;
    }>;
};

/*
AGENT
- 타입을 따로 빼서 관리하지 않음. 
- 호출부에서 객체 형태로 바로 사용해. 
*/
type PlayerDraft = {
    products: Array<{ id: string; title: string; coverImageUrl?: string }>;
    episodes: Array<{ id: string; productId: string; episodeNumber: number; title: string; subTitle?: string }>;
    characters: Array<{ id: string; name: string; color: string }>;
    scripts: Array<{ id: string; episodeId: string; characterId: string; text: string; sortOrder: number }>;
    tracks: Array<{
        id: string;
        episodeId: string;
        name: string;
        kind: PlayerTrackKind;
        layerId: number;
        isMuted: boolean;
    }>;
    items: PlayerItem[];
    canvases: PlayerCanvas[];
    media: Array<{
        id: string;
        episodeId: string;
        kind: 'image' | 'video' | 'audio' | 'effect';
        url: string;
        naturalWidth?: number;
        naturalHeight?: number;
        durationMs?: number;
    }>;
    cues: Array<{
        id: string;
        episodeId: string;
        scriptId: string;
        characterId?: string;
        trackId: string;
        audioId?: string;
        startCanvasMediaId?: string;
        endCanvasMediaId?: string;
        startTime: number;
        endTime: number;
        startPosition: number;
        endPosition: number;
        ttsUrl?: string;
        volume: number;
    }>;
    scrolls: Array<{
        id: string;
        trackId: string;
        canvasId?: string;
        startIndex: number;
        endIndex: number;
        startTime: number;
        endTime: number;
        startPosition: number;
        endPosition: number;
    }>;
    anchors: Array<{
        id: string;
        trackId: string;
        canvasId: string;
        time: number;
        position: number;
        index: number;
    }>;
    records: Array<{
        id: string;
        cueId: string;
        artistId: string | null;
        recordUrl: string;
        duration?: number;
        volume: number;
        isAccepted: boolean;
    }>;
    screenEffects: Array<{ type: 'effect'; uuid: string; time_ms: number; params: Record<string, unknown> }>;
};

/*
AGENT
- 타입을 따로 빼서 관리하지 않음. 
- 호출부에서 객체 형태로 바로 사용해. 
*/
type PlayerManifest = {
    episodeId: string;
    durationMs: number;
    previewCanvasId?: number;
    tracks: Array<{ id: string; name: string; kind: PlayerTrackKind; layerId: number; isMuted: boolean }>;
    items: Array<PlayerItem & { volume: number }>;
    cues: Array<{
        id: string;
        scriptId: string;
        characterId?: string;
        trackId: string;
        audioId?: string;
        startTime: number;
        endTime: number;
        approvedRecordUrl?: string;
        ttsUrl?: string;
        volume: number;
    }>;
    canvases: PlayerCanvas[];
    media: Array<Omit<PlayerDraft['media'][number], 'episodeId'>>;
    records: PlayerDraft['records'];
    scrolls: PlayerDraft['scrolls'];
    anchors: PlayerDraft['anchors'];
    tts: Array<{ id: string; cueId: string; voiceId: string; provider: string; voiceName: string; audioUrl: string }>;
};

function toId(value: number | string) {
    return String(value);
}

function toCueScriptId(cueId: number | string) {
    return `cue-${toId(cueId)}`;
}

function toTrackKind(type: TrackType): PlayerTrackKind {
    if (type === 'record') return 'dialogue';
    if (type === 'audio' || type === 'bgm') return 'audio';
    if (type === 'effect') return 'effect';
    return 'visual';
}

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

function toPlayerCanvases(canvases: Canvas[]): PlayerCanvas[] {
    return canvases.map((canvas) => {
        const canvasMedias = [...canvas.canvasMedias].sort(
            (a, b) =>
                (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER) ||
                a.media.id - b.media.id
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

function getPreviewVisualTimingItems(visualMediaItems: Array<{ canvasMedia: CanvasMedia; media: CanvasMedia['media'] }>) {
    let nextStartTime = 0;

    return visualMediaItems.map(({ canvasMedia, media }) => {
        const hasTimelineControls =
            media.mediaType === 'video' &&
            typeof canvasMedia.startTime === 'number' &&
            typeof canvasMedia.endTime === 'number' &&
            canvasMedia.endTime > canvasMedia.startTime;
        const duration = hasTimelineControls
            ? Math.max(MIN_TIMELINE_ITEM_DURATION_MS, canvasMedia.endTime! - canvasMedia.startTime!)
            : media.mediaType === 'video' && typeof media.duration === 'number' && Number.isFinite(media.duration) && media.duration > 0
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

    async getDraft({ episodeId }: { episodeId: number }): Promise<PlayerDraft> {
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
                (aCanvasMedia?.index ?? Number.MAX_SAFE_INTEGER) -
                    (bCanvasMedia?.index ?? Number.MAX_SAFE_INTEGER) ||
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
            (a, b) =>
                (a.startTime ?? Number.MAX_SAFE_INTEGER) - (b.startTime ?? Number.MAX_SAFE_INTEGER) || a.id - b.id
        );
        anchors.sort((a, b) => a.time - b.time || a.id - b.id);
        scrolls.sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0) || a.id - b.id);
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
            id: toCueScriptId(cue.id),
            episodeId: toId(episode.id),
            characterId: cue.characterId ? toId(cue.characterId) : '',
            text: cue.script,
            sortOrder: index + 1,
        }));

        const initialTracksDraft = tracks.map((track) => ({
            id: toId(track.id),
            episodeId: toId(episode.id),
            name: track.name,
            kind: toTrackKind(track.type),
            layerId: 0,
            isMuted: track.isMuted,
        }));
        const visualTrack =
            initialTracksDraft.find((track) => track.kind === 'visual') ??
            (visualMediaItems.length > 0
                ? {
                      id: `visual-${episode.id}`,
                      episodeId: toId(episode.id),
                      name: 'Visual',
                      kind: 'visual' as const,
                      layerId: 0,
                      isMuted: false,
                  }
                : undefined);
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

        return {
            products: [
                {
                    id: toId(episode.product.id),
                    title: episode.product.title,
                    coverImageUrl: episode.product.coverImageUrl ?? undefined,
                },
            ],
            episodes: [
                {
                    id: toId(episode.id),
                    productId: toId(episode.productId),
                    episodeNumber: episode.episodeNumber,
                    title: episode.title,
                    subTitle: episode.subTitle,
                },
            ],
            characters: characters.map((character) => ({
                id: toId(character.id),
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
                        id:
                            canvas.canvasMedias.length === 1
                                ? `visual-${canvas.id}`
                                : `visual-${canvas.id}-${media.id}`,
                        trackId: visualTrack?.id ?? `visual-${episode.id}`,
                        kind: 'visual' as const,
                        startTime: timing.startTime,
                        endTime: timing.endTime,
                        canvasId: toId(canvas.id),
                        index: mediaIndex,
                        mediaId: toId(media.id),
                        layerId: index,
                        trimStartTime:
                            typeof canvasMedia.sourceStartTime === 'number' ? canvasMedia.sourceStartTime : undefined,
                        trimEndTime: typeof canvasMedia.sourceEndTime === 'number' ? canvasMedia.sourceEndTime : undefined,
                        hasTimelineControls: timing.hasTimelineControls,
                        isMuted: canvasMedia.isMuted === true,
                        volume: canvasMedia.isMuted ? 0 : canvasMedia.volume,
                    };
                }),
                ...scheduledCues.map((cue) => ({
                    id: `cue-${cue.id}`,
                    trackId: toId(cue.trackId),
                    kind:
                        cue.audioId && trackKindById.get(toId(cue.trackId)) === 'effect'
                            ? ('effect' as const)
                            : cue.audioId
                              ? ('audio' as const)
                              : ('cue' as const),
                    startTime: cue.startTime,
                    endTime: cue.endTime,
                    cueId: toId(cue.id),
                    mediaId: cue.audioId ? `audio-${toId(cue.audioId)}` : undefined,
                    layerId: layerIdByTrackId.get(toId(cue.trackId)) ?? 1,
                    volume: cue.volume,
                })),
            ].sort((a, b) => a.startTime - b.startTime || a.layerId - b.layerId || a.id.localeCompare(b.id)),
            media: [
                ...canvases.flatMap((canvas) =>
                    canvas.canvasMedias.map((canvasMedia) => ({
                        id: toId(canvasMedia.media.id),
                        episodeId: toId(episode.id),
                        kind: canvasMedia.media.mediaType,
                        url: canvasMedia.media.mediaUrl,
                        ...(typeof canvasMedia.media.duration === 'number'
                            ? { durationMs: canvasMedia.media.duration }
                            : {}),
                    }))
                ),
                ...audios.map((audio) => ({
                    id: `audio-${toId(audio.id)}`,
                    episodeId: toId(episode.id),
                    kind: audio.audioType === 'effect' ? ('effect' as const) : ('audio' as const),
                    url: audio.audioUrl,
                    durationMs: audio.duration,
                })),
            ],
            cues: scheduledCues.map((cue) => ({
                id: toId(cue.id),
                episodeId: toId(episode.id),
                scriptId: toCueScriptId(cue.id),
                characterId: cue.characterId ? toId(cue.characterId) : undefined,
                trackId: toId(cue.trackId),
                audioId: cue.audioId ? toId(cue.audioId) : undefined,
                startCanvasMediaId: cue.startCanvasMediaId ? toId(cue.startCanvasMediaId) : undefined,
                endCanvasMediaId: cue.endCanvasMediaId ? toId(cue.endCanvasMediaId) : undefined,
                startTime: cue.startTime,
                endTime: cue.endTime,
                startPosition: cue.startPosition,
                endPosition: cue.endPosition,
                volume: cue.volume,
            })),
            scrolls: scrolls.map((scroll) => ({
                id: toId(scroll.id),
                trackId: toId(scroll.trackId),
                canvasId: typeof scroll.canvasId === 'number' ? toId(scroll.canvasId) : undefined,
                startIndex: scroll.startIndex ?? 0,
                endIndex: scroll.endIndex ?? scroll.startIndex ?? 0,
                startTime: scroll.startTime ?? 0,
                endTime: scroll.endTime ?? scroll.startTime ?? 0,
                startPosition: scroll.startPosition ?? 0,
                endPosition: scroll.endPosition ?? scroll.startPosition ?? 0,
            })),
            anchors: anchors.map((anchor) => ({
                id: toId(anchor.id),
                trackId: toId(anchor.trackId),
                canvasId: toId(anchor.canvasId),
                time: anchor.time,
                position: anchor.position,
                index: anchor.index,
            })),
            records: records.map((record) => ({
                id: toId(record.id),
                cueId: toId(record.cueId),
                artistId: record.artistId === null ? null : toId(record.artistId),
                recordUrl: record.recordUrl,
                duration: record.duration ?? undefined,
                volume: record.volume,
                isAccepted: record.isAccepted,
            })),
            screenEffects: [],
        };
    }

    async getManifest({ episodeId }: { episodeId: number }): Promise<PlayerManifest> {
        return this.toManifest(await this.getDraft({ episodeId }));
    }

    toManifest(draft: PlayerDraft): PlayerManifest {
        const recordByCueId = new Map<string, PlayerDraft['records'][number]>();
        for (const record of draft.records) {
            const currentRecord = recordByCueId.get(record.cueId);
            if (!currentRecord || (!currentRecord.isAccepted && record.isAccepted)) {
                recordByCueId.set(record.cueId, record);
            }
        }
        const cues = draft.cues.map((cue) => ({
            id: cue.id,
            scriptId: cue.scriptId,
            characterId: cue.characterId,
            trackId: cue.trackId,
            audioId: cue.audioId,
            startTime: cue.startTime,
            endTime: cue.endTime,
            approvedRecordUrl: recordByCueId.get(cue.id)?.recordUrl,
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
                const record = recordByCueId.get(cue.id);
                return record ? cue.startTime + (record.duration ?? cue.endTime - cue.startTime) : 0;
            })
        );

        return {
            episodeId: draft.episodes[0]?.id ?? '',
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
