import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Cue } from '../../cues/domain/cue.entity';
import { CueRepository } from '../../cues/repository/cue.repository';
import { Track, type TrackType } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { Audio, type AudioType } from '../domain/audio.entity';
import { AudioRepository } from '../repository/audio.repository';

@Injectable()
export class AudioService extends DddService {
    constructor(
        private readonly audioRepository: AudioRepository,
        private readonly trackRepository: TrackRepository,
        private readonly cueRepository: CueRepository
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
        const [audios, total] = await Promise.all([
            this.audioRepository.findByEpisodeId(episodeId),
            this.audioRepository.countByEpisodeId(episodeId),
        ]);
        const items = audios.map((audio) => {
            return {
                id: audio.id,
                episodeId: audio.episodeId,
                ...(audio.cue?.id ? { cueId: audio.cue.id } : {}),
                audioType: audio.audioType,
                name: audio.name,
                audioUrl: audio.audioUrl,
                duration: audio.duration ?? undefined,
            };
        });

        return { items, total };
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
        const [linkedCue] = await this.cueRepository.find({ audioId });

        if (!audio) {
            throw new NotFoundException('Audio not found.');
        }
        if (linkedCue) {
            throw new BadRequestException('Audio is already linked to a cue.');
        }
        if (!Number.isFinite(startTime)) {
            throw new BadRequestException('Cue startTime is required.');
        }

        const resolvedEndTime = endTime ?? startTime + (audio.duration ?? 4000);
        if (!Number.isFinite(resolvedEndTime) || resolvedEndTime <= startTime) {
            throw new BadRequestException('Cue endTime must be greater than startTime.');
        }

        const result = await this.audioRepository.entityManager.transaction(async (entityManager) => {
            const targetTrack = trackId
                ? await entityManager.findOne(Track, { where: { id: trackId, episodeId } })
                : undefined;

            if (trackId && !targetTrack) {
                throw new NotFoundException('Track not found.');
            }
            if (targetTrack && (targetTrack.type === 'scroll' || targetTrack.type === 'scrolls')) {
                throw new BadRequestException('Audio cannot be dropped on a scroll track.');
            }
            if (targetTrack?.type === 'record' && !targetTrack.characterId) {
                throw new BadRequestException('Record track must be linked to a character.');
            }

            const track =
                targetTrack ??
                (await entityManager.save(
                    new Track({
                        episodeId,
                        name: trackName?.trim() || audio.name,
                        type: trackType ?? (audio.audioType === 'bgm' || audio.audioType === 'effect' ? audio.audioType : 'audio'),
                        characterId,
                    })
                ));

            if (track.type === 'record' && !track.characterId) {
                throw new BadRequestException('Record track must be linked to a character.');
            }

            const cue = await entityManager.save(
                new Cue({
                    script: audio.name,
                    characterId: track.characterId,
                    trackId: track.id,
                    audioId: audio.id,
                    startTime,
                    endTime: resolvedEndTime,
                    volume,
                })
            );

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
                script: result.cue.script,
                characterId: result.cue.characterId,
                trackId: result.cue.trackId,
                audioId: result.cue.audioId,
                startTime: result.cue.startTime,
                endTime: result.cue.endTime,
                ttsVoiceId: result.cue.ttsVoiceId,
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
