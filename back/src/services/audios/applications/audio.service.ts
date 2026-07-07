import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Cue } from '../../cues/domain/cue.entity';
import { Script } from '../../scripts/domain/script.entity';
import { Track, type TrackType } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { Audio, type AudioType } from '../domain/audio.entity';
import { AudioRepository } from '../repository/audio.repository';

@Injectable()
export class AudioService extends DddService {
    constructor(
        private readonly audioRepository: AudioRepository,
        private readonly trackRepository: TrackRepository
    ) {
        super();
    }

    async create({
        episodeId,
        audioType,
        name,
        audioUrl,
        duration,
    }: {
        episodeId: number;
        audioType: AudioType;
        name: string;
        audioUrl: string;
        duration?: number;
    }) {
        const audio = new Audio({
            episodeId,
            audioType,
            name,
            audioUrl,
            duration,
        });
        await this.audioRepository.save([audio]);

        return {
            id: audio.id,
            episodeId: audio.episodeId,
            audioType: audio.audioType,
            name: audio.name,
            audioUrl: audio.audioUrl,
            duration: audio.duration ?? undefined,
        };
    }

    async list({ episodeId }: { episodeId: number }) {
        const audios = await this.audioRepository.findByEpisodeId(episodeId);
        const visibleAudios = audios.filter((audio) => audio.audioType !== 'record');
        const items = visibleAudios.map((audio) => {
            const cueId = audio.cues?.[0]?.id;

            return {
                id: audio.id,
                episodeId: audio.episodeId,
                ...(cueId ? { cueId } : {}),
                audioType: audio.audioType,
                name: audio.name,
                audioUrl: audio.audioUrl,
                duration: audio.duration ?? undefined,
            };
        });

        return { items, total: items.length };
    }

    async dropToTrack({
        episodeId,
        audioId,
        trackId,
        trackName,
        trackType,
        characterId,
        startTime,
        endTime,
        volume,
    }: {
        episodeId: number;
        audioId: number;
        trackId?: number;
        trackName?: string;
        trackType?: Extract<TrackType, 'audio' | 'bgm' | 'effect' | 'record'>;
        characterId?: number;
        startTime: number;
        endTime?: number;
        volume?: number;
    }) {
        const [audio] = await this.audioRepository.find({ id: audioId, episodeId });

        if (!audio) {
            throw new NotFoundException('오디오를 찾을 수 없습니다.');
        }
        // Number.isFinite는 NaN, Infinity, -Infinity처럼 타임라인에 배치할 수 없는 숫자를 걸러낸다.
        /*
        AGENT
        - finite가 뭔데? 주석설명. 
        */
        if (!Number.isFinite(startTime)) {
            throw new BadRequestException('큐 startTime이 필요합니다.');
        }

        const resolvedEndTime = endTime ?? startTime + (audio.duration ?? 4000);
        if (!Number.isFinite(resolvedEndTime) || resolvedEndTime <= startTime) {
            throw new BadRequestException('큐 endTime은 startTime보다 커야 합니다.');
        }

        const result = await this.audioRepository.entityManager.transaction(async (entityManager) => {
            const targetTrack = trackId
                ? await entityManager.findOne(Track, { where: { id: trackId, episodeId } })
                : undefined;

            if (trackId && !targetTrack) {
                throw new NotFoundException('트랙을 찾을 수 없습니다.');
            }
            if (targetTrack && (targetTrack.type === 'scroll' || targetTrack.type === 'scrolls')) {
                throw new BadRequestException('오디오는 스크롤 트랙에 추가할 수 없습니다.');
            }
            if (targetTrack?.type === 'record' && !targetTrack.characterId) {
                throw new BadRequestException('녹음 트랙은 캐릭터와 연결되어야 합니다.');
            }

            const track =
                targetTrack ??
                (await entityManager.save(
                    new Track({
                        episodeId,
                        name: trackName?.trim() || audio.name,
                        type:
                            trackType ??
                            (audio.audioType === 'bgm' || audio.audioType === 'effect' ? audio.audioType : 'audio'),
                        characterId,
                    })
                ));

            if (track.type === 'record' && !track.characterId) {
                throw new BadRequestException('녹음 트랙은 캐릭터와 연결되어야 합니다.');
            }

            const script = await entityManager.save(
                new Script({
                    line: audio.name,
                })
            );
            const cue = await entityManager.save(
                new Cue({
                    scriptId: script.id,
                    characterId: track.characterId,
                    trackId: track.id,
                    audioId: audio.id,
                    startTime,
                    endTime: resolvedEndTime,
                    audioStartTime: 0,
                    audioEndTime: resolvedEndTime - startTime,
                    volume,
                })
            );
            cue.scriptRef = script;

            return { track, cue };
        });

        return {
            track: {
                id: result.track.id,
                episodeId: result.track.episodeId,
                name: result.track.name,
                type: result.track.type,
                characterId: result.track.characterId,
                isMuted: result.track.isMuted,
            },
            cue: {
                id: result.cue.id,
                scriptId: result.cue.scriptId,
                script: result.cue.scriptRef?.line ?? '',
                characterId: result.cue.characterId,
                trackId: result.cue.trackId,
                audioId: result.cue.audioId,
                startCanvasMediaId: result.cue.startCanvasMediaId,
                endCanvasMediaId: result.cue.endCanvasMediaId,
                startTime: result.cue.startTime,
                endTime: result.cue.endTime,
                audioStartTime: result.cue.audioStartTime,
                audioEndTime: result.cue.audioEndTime,
                startPosition: result.cue.startPosition,
                endPosition: result.cue.endPosition,
                volume: result.cue.volume,
            },
            audio: {
                id: audio.id,
                episodeId: audio.episodeId,
                audioType: audio.audioType,
                name: audio.name,
                audioUrl: audio.audioUrl,
                duration: audio.duration ?? undefined,
            },
        };
    }
}
