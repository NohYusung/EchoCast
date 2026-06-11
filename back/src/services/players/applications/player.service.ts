import { Injectable, NotFoundException } from '@nestjs/common';
import { checkInValue } from '../../../libs/utils/typeorm';
import { DddService } from '../../../libs/ddd';
import { TtsVoice } from '../../TTS-voices/domain/tts-voice.entity';
import { TtsVoiceRepository } from '../../TTS-voices/repository/tts-voice.repository';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import { CharacterRepository } from '../../characters/repository/characater.repository';
import { CueRepository } from '../../cues/repository/cue.repository';
import { EpisodeRepository } from '../../episodes/repository/episode.repository';
import { Record as RecordEntity } from '../../records/domain/record.entity';
import { RecordRepository } from '../../records/repository/record.repository';
import { ScrollRepository } from '../../scrolls/repository/scroll.repository';
import type { TrackType } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
type TimelineItemKind = 'visual' | 'audio' | 'effect' | 'cue';
type PlayerTrackKind = 'visual' | 'dialogue' | 'audio' | 'effect';

type PlayerDraft = {
    products: Array<{ id: string; title: string; coverImageUrl?: string }>;
    episodes: Array<{ id: string; productId: string; episodeNumber: number; title: string; subTitle?: string }>;
    characters: Array<{ id: string; name: string; color: string; defaultTtsVoiceId?: string }>;
    scripts: Array<{ id: string; episodeId: string; characterId: string; text: string; sortOrder: number }>;
    tracks: Array<{
        id: string;
        episodeId: string;
        name: string;
        kind: PlayerTrackKind;
        layerId: number;
        isMuted: boolean;
    }>;
    timelineItems: Array<{
        id: string;
        trackId: string;
        kind: TimelineItemKind;
        startTime: number;
        endTime: number;
        mediaId?: string;
        cueId?: string;
        layerId: number;
        trimStartTime?: number;
        trimEndTime?: number;
        volume?: number;
    }>;
    media: Array<{
        id: string;
        episodeId: string;
        kind: 'image' | 'video' | 'audio' | 'effect';
        url: string;
        naturalWidth?: number;
        naturalHeight?: number;
        durationMs?: number;
    }>;
    ttsVoices: Array<{ id: string; provider: string; voiceName: string; languageCode: string }>;
    cues: Array<{
        id: string;
        episodeId: string;
        scriptId: string;
        characterId: string;
        trackId: string;
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
        status: 'draft' | 'approved' | 'rejected';
        audioUrl: string;
        durationMs: number;
        volume: number;
    }>;
    screenEffects: Array<{ type: 'effect'; uuid: string; time_ms: number; params: Record<string, unknown> }>;
};

type PlayerManifest = {
    episodeId: string;
    durationMs: number;
    tracks: Array<{ id: string; name: string; kind: PlayerTrackKind; layerId: number; isMuted: boolean }>;
    items: Array<PlayerDraft['timelineItems'][number] & { volume: number }>;
    cues: Array<{
        id: string;
        scriptId: string;
        characterId: string;
        trackId: string;
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
        private readonly scrollRepository: ScrollRepository,
        private readonly recordRepository: RecordRepository,
        private readonly ttsVoiceRepository: TtsVoiceRepository
    ) {
        super();
    }

    async getDraft({ episodeId }: { episodeId: number }): Promise<PlayerDraft> {
        const [episode] = await this.episodeRepository.find({ id: episodeId }, { relations: { product: true } });
        if (!episode) {
            throw new NotFoundException('Episode not found.');
        }

        const [characters, tracks, canvases] = await Promise.all([
            this.characterRepository.find({ productId: episode.productId }, { options: { sort: 'id', order: 'ASC' } }),
            this.trackRepository.find({ episodeId }, { options: { sort: 'id', order: 'ASC' } }),
            this.canvasRepository.find({ episodeId }, { relations: { medias: true } }),
        ]);
        canvases.sort((a, b) => {
            const [aMedia] = a.medias;
            const [bMedia] = b.medias;

            return (aMedia?.index ?? Number.MAX_SAFE_INTEGER) - (bMedia?.index ?? Number.MAX_SAFE_INTEGER);
        });
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
        const ttsVoiceIds = cues.flatMap((cue) => (cue.ttsVoiceId ? [cue.ttsVoiceId] : []));
        const [records, ttsVoices]: [RecordEntity[], TtsVoice[]] = await Promise.all([
            cueIds.length > 0
                ? this.recordRepository.find(
                      { cueId: checkInValue(cueIds) },
                      { options: { sort: 'cueId', order: 'ASC' } }
                  )
                : [],
            ttsVoiceIds.length > 0
                ? this.ttsVoiceRepository.find(
                      { id: checkInValue(ttsVoiceIds) },
                      { options: { sort: 'id', order: 'ASC' } }
                  )
                : [],
        ]);
        records.sort((a, b) => a.cueId - b.cueId || a.id - b.id);
        const ttsVoiceById = new Map<number, TtsVoice>(
            ttsVoices.map((voice): [number, TtsVoice] => [voice.id, voice])
        );
        const scripts = cues.map((cue, index) => ({
            id: toCueScriptId(cue.id),
            episodeId: toId(episode.id),
            characterId: toId(cue.characterId),
            text: cue.script,
            sortOrder: index + 1,
        }));
        const firstTtsVoiceByCharacterId = new Map<string, string>();
        for (const cue of cues) {
            if (!cue.ttsVoiceId || firstTtsVoiceByCharacterId.has(toId(cue.characterId))) continue;
            firstTtsVoiceByCharacterId.set(toId(cue.characterId), toId(cue.ttsVoiceId));
        }

        const tracksDraft = tracks.map((track, index) => ({
            id: toId(track.id),
            episodeId: toId(episode.id),
            name: track.name,
            kind: toTrackKind(track.type),
            layerId: index,
            isMuted: track.isMuted,
        }));
        const visualTrack =
            tracksDraft.find((track) => track.kind === 'visual') ??
            (canvases.length > 0
                ? {
                      id: `visual-${episode.id}`,
                      episodeId: toId(episode.id),
                      name: 'Visual',
                      kind: 'visual' as const,
                      layerId: 0,
                      isMuted: false,
                  }
                : undefined);
        if (visualTrack && !tracksDraft.some((track) => track.id === visualTrack.id)) {
            tracksDraft.unshift(visualTrack);
        }
        const layerIdByTrackId = new Map(tracksDraft.map((track) => [track.id, track.layerId]));
        const maxCueEndTime = Math.max(0, ...cues.map((cue) => cue.endTime));
        const fallbackVisualEndTime = Math.max(maxCueEndTime, 1);

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
                defaultTtsVoiceId: firstTtsVoiceByCharacterId.get(toId(character.id)),
            })),
            scripts,
            tracks: tracksDraft,
            timelineItems: [
                ...canvases.map((canvas, index) => {
                    const scroll = scrolls[index];
                    const [media] = canvas.medias;
                    return {
                        id: `visual-${canvas.id}`,
                        trackId: visualTrack?.id ?? `visual-${episode.id}`,
                        kind: 'visual' as const,
                        startTime: scroll?.startTime ?? 0,
                        endTime: scroll?.endTime ?? fallbackVisualEndTime,
                        mediaId: media ? toId(media.id) : undefined,
                        layerId: index,
                    };
                }),
                ...cues.map((cue) => ({
                    id: `cue-${cue.id}`,
                    trackId: toId(cue.trackId),
                    kind: 'cue' as const,
                    startTime: cue.startTime,
                    endTime: cue.endTime,
                    cueId: toId(cue.id),
                    layerId: layerIdByTrackId.get(toId(cue.trackId)) ?? 1,
                    volume: cue.volume,
                })),
            ].sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id)),
            media: canvases.flatMap((canvas) =>
                canvas.medias.map((media) => ({
                    id: toId(media.id),
                    episodeId: toId(episode.id),
                    kind: media.mediaType,
                    url: media.mediaUrl,
                }))
            ),
            ttsVoices: ttsVoices.map((voice) => ({
                id: toId(voice.id),
                provider: voice.provider,
                voiceName: voice.voiceName,
                languageCode: voice.languageCode,
            })),
            cues: cues.map((cue) => {
                const ttsVoice = cue.ttsVoiceId ? ttsVoiceById.get(cue.ttsVoiceId) : undefined;
                return {
                    id: toId(cue.id),
                    episodeId: toId(episode.id),
                    scriptId: toCueScriptId(cue.id),
                    characterId: toId(cue.characterId),
                    trackId: toId(cue.trackId),
                    startTime: cue.startTime,
                    endTime: cue.endTime,
                    ttsVoiceId: cue.ttsVoiceId ? toId(cue.ttsVoiceId) : undefined,
                    ttsUrl: ttsVoice?.fileUrl,
                    volume: cue.volume,
                };
            }),
            records: records.map((record) => ({
                id: toId(record.id),
                cueId: toId(record.cueId),
                artistId: toId(record.artistId),
                status: record.status,
                audioUrl: record.audioUrl,
                durationMs: record.durationMs,
                volume: record.volume,
            })),
            screenEffects: [],
        };
    }

    async getManifest({ episodeId }: { episodeId: number }): Promise<PlayerManifest> {
        return this.toManifest(await this.getDraft({ episodeId }));
    }

    toManifest(draft: PlayerDraft): PlayerManifest {
        const approvedRecordByCueId = new Map(
            draft.records.filter((record) => record.status === 'approved').map((record) => [record.cueId, record])
        );
        const ttsVoiceById = new Map(draft.ttsVoices.map((voice) => [voice.id, voice]));
        const cues = draft.cues.map((cue) => ({
            id: cue.id,
            scriptId: cue.scriptId,
            characterId: cue.characterId,
            trackId: cue.trackId,
            startTime: cue.startTime,
            endTime: cue.endTime,
            approvedRecordUrl: approvedRecordByCueId.get(cue.id)?.audioUrl,
            ttsUrl: cue.ttsUrl,
            volume: cue.volume,
        }));
        const durationMs = Math.max(
            0,
            ...draft.timelineItems.map((item) => item.endTime),
            ...draft.cues.map((cue) => cue.endTime),
            ...draft.cues.map((cue) => {
                const approvedRecord = approvedRecordByCueId.get(cue.id);
                return approvedRecord ? cue.startTime + approvedRecord.durationMs : 0;
            })
        );

        return {
            episodeId: draft.episodes[0]?.id ?? '',
            durationMs,
            tracks: draft.tracks.map(({ episodeId: _episodeId, ...track }) => track),
            items: draft.timelineItems.map((item) => ({
                ...item,
                volume: item.volume ?? 1,
            })),
            cues,
            media: draft.media.map(({ episodeId: _episodeId, ...media }) => media),
            records: draft.records,
            tts: draft.cues.flatMap((cue) => {
                if (!cue.ttsVoiceId || !cue.ttsUrl) return [];

                const voice = ttsVoiceById.get(cue.ttsVoiceId);
                if (!voice) return [];

                return [
                    {
                        id: `tts-${cue.id}`,
                        cueId: cue.id,
                        voiceId: cue.ttsVoiceId,
                        provider: voice.provider,
                        voiceName: voice.voiceName,
                        audioUrl: cue.ttsUrl,
                    },
                ];
            }),
        };
    }
}
