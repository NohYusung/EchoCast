import { Injectable, NotFoundException } from '@nestjs/common';
import { checkInValue } from '../../../libs/utils/typeorm';
import { DddService } from '../../../libs/ddd';
import { AudioRepository } from '../../audios/repository/audio.repository';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import { CharacterRepository } from '../../characters/repository/characater.repository';
import { CueRepository } from '../../cues/repository/cue.repository';
import { EpisodeRepository } from '../../episodes/repository/episode.repository';
import { Record as RecordEntity } from '../../records/domain/record.entity';
import { RecordRepository } from '../../records/repository/record.repository';
import { ScrollRepository } from '../../scrolls/repository/scroll.repository';
import type { TrackType } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
type PlayerTrackKind = 'visual' | 'dialogue' | 'audio' | 'effect';

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
    mediaId?: string;
    cueId?: string;
    layerId: number;
    trimStartTime?: number;
    trimEndTime?: number;
    volume?: number;
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
        startTime: number;
        endTime: number;
        ttsVoiceId?: string;
        ttsUrl?: string;
        volume: number;
    }>;
    records: Array<{
        id: string;
        cueId: string;
        artistId: string;
        audioUrl: string;
        duration?: number;
        volume: number;
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
    media: Array<Omit<PlayerDraft['media'][number], 'episodeId'>>;
    records: PlayerDraft['records'];
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

@Injectable()
export class PlayerService extends DddService {
    constructor(
        private readonly episodeRepository: EpisodeRepository,
        private readonly characterRepository: CharacterRepository,
        private readonly trackRepository: TrackRepository,
        private readonly canvasRepository: CanvasRepository,
        private readonly cueRepository: CueRepository,
        private readonly audioRepository: AudioRepository,
        private readonly scrollRepository: ScrollRepository,
        private readonly recordRepository: RecordRepository
    ) {
        super();
    }

    async getDraft({ episodeId }: { episodeId: number }): Promise<PlayerDraft> {
        const [episode] = await this.episodeRepository.find({ id: episodeId }, { relations: { product: true } });
        if (!episode) {
            throw new NotFoundException('Episode not found.');
        }

        const [characters, tracks, canvases, audios] = await Promise.all([
            this.characterRepository.find({ productId: episode.productId }, { options: { sort: 'id', order: 'ASC' } }),
            this.trackRepository.find({ episodeId }, { options: { sort: 'id', order: 'ASC' } }),
            this.canvasRepository.find({ episodeId }, { relations: { medias: true } }),
            this.audioRepository.find({ episodeId }, { options: { sort: 'id', order: 'ASC' } }),
        ]);
        canvases.forEach((canvas) => {
            canvas.medias = [...canvas.medias].sort(
                (a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER) || a.id - b.id
            );
        });
        canvases.sort((a, b) => {
            const [aMedia] = a.medias;
            const [bMedia] = b.medias;

            return (
                (aMedia?.index ?? Number.MAX_SAFE_INTEGER) - (bMedia?.index ?? Number.MAX_SAFE_INTEGER) || a.id - b.id
            );
        });
        const visualMediaItems = canvases
            .flatMap((canvas) => canvas.medias.map((media) => ({ canvas, media })))
            .sort(
                (a, b) =>
                    (a.media.index ?? Number.MAX_SAFE_INTEGER) - (b.media.index ?? Number.MAX_SAFE_INTEGER) ||
                    a.canvas.id - b.canvas.id ||
                    a.media.id - b.media.id
            );
        const trackIds = tracks.map((track) => track.id);
        const [cues, scrolls] =
            trackIds.length > 0
                ? await Promise.all([
                      this.cueRepository.find(
                          { trackId: checkInValue(trackIds) },
                          { options: { sort: 'startTime', order: 'ASC' } }
                      ),
                      this.scrollRepository.find(
                          { trackId: checkInValue(trackIds) },
                          { options: { sort: 'startTime', order: 'ASC' } }
                      ),
                  ])
                : [[], []];
        cues.sort((a, b) => a.startTime - b.startTime || a.id - b.id);
        scrolls.sort((a, b) => a.startTime - b.startTime || a.id - b.id);
        const cueIds = cues.map((cue) => cue.id);
        const records: RecordEntity[] =
            cueIds.length > 0
                ? await this.recordRepository.find(
                      { cueId: checkInValue(cueIds) },
                      { options: { sort: 'cueId', order: 'ASC' } }
                  )
                : [];
        records.sort((a, b) => a.cueId - b.cueId || a.id - b.id);
        const scripts = cues.map((cue, index) => ({
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
        const maxCueEndTime = Math.max(0, ...cues.map((cue) => cue.endTime));
        const fallbackVisualEndTime = Math.max(maxCueEndTime, 1);
        const fallbackVisualDuration =
            visualMediaItems.length > 0
                ? Math.max(1, fallbackVisualEndTime / visualMediaItems.length)
                : fallbackVisualEndTime;

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
            items: [
                ...visualMediaItems.map(({ canvas, media }, index) => {
                    const scroll = scrolls[index];
                    const fallbackStartTime = Number((index * fallbackVisualDuration).toFixed(3));
                    const fallbackEndTime = Number(((index + 1) * fallbackVisualDuration).toFixed(3));

                    return {
                        id: canvas.medias.length === 1 ? `visual-${canvas.id}` : `visual-${canvas.id}-${media.id}`,
                        trackId: visualTrack?.id ?? `visual-${episode.id}`,
                        kind: 'visual' as const,
                        startTime: scroll?.startTime ?? fallbackStartTime,
                        endTime: scroll?.endTime ?? Math.max(fallbackEndTime, fallbackStartTime + 1),
                        mediaId: toId(media.id),
                        layerId: index,
                    };
                }),
                ...cues.map((cue) => ({
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
            ].sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id)),
            media: [
                ...canvases.flatMap((canvas) =>
                    canvas.medias.map((media) => ({
                        id: toId(media.id),
                        episodeId: toId(episode.id),
                        kind: media.mediaType,
                        url: media.mediaUrl,
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
            cues: cues.map((cue) => ({
                id: toId(cue.id),
                episodeId: toId(episode.id),
                scriptId: toCueScriptId(cue.id),
                characterId: cue.characterId ? toId(cue.characterId) : undefined,
                trackId: toId(cue.trackId),
                audioId: cue.audioId ? toId(cue.audioId) : undefined,
                startTime: cue.startTime,
                endTime: cue.endTime,
                ttsVoiceId: cue.ttsVoiceId ? toId(cue.ttsVoiceId) : undefined,
                volume: cue.volume,
            })),
            records: records.map((record) => ({
                id: toId(record.id),
                cueId: toId(record.cueId),
                artistId: toId(record.artistId),
                audioUrl: record.audioUrl,
                duration: record.duration ?? undefined,
                volume: record.volume,
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
            if (!recordByCueId.has(record.cueId)) {
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
            approvedRecordUrl: recordByCueId.get(cue.id)?.audioUrl,
            ttsUrl: cue.ttsUrl,
            volume: cue.volume,
        }));
        const durationMs = Math.max(
            0,
            ...draft.items.map((item) => item.endTime),
            ...draft.cues.map((cue) => cue.endTime),
            ...draft.cues.map((cue) => {
                const record = recordByCueId.get(cue.id);
                return record ? cue.startTime + (record.duration ?? cue.endTime - cue.startTime) : 0;
            })
        );

        return {
            episodeId: draft.episodes[0]?.id ?? '',
            durationMs,
            tracks: draft.tracks.map(({ episodeId: _episodeId, ...track }) => track),
            items: draft.items.map((item) => ({
                ...item,
                volume: item.volume ?? 1,
            })),
            cues,
            media: draft.media.map(({ episodeId: _episodeId, ...media }) => media),
            records: draft.records,
            tts: [],
        };
    }
}
