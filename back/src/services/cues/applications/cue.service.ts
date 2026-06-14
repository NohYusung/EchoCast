import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { checkInValue } from '../../../libs/utils/typeorm';
import type { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { CanvasMediaRepository } from '../../canvas-medias/repository/canvas-media.repository';
import { Audio } from '../../audios/domain/audio.entity';
import type { Track } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { Cue } from '../domain/cue.entity';
import { CueRepository } from '../repository/cue.repository';

const DEFAULT_PENDING_CUE_DURATION_MS = 1000;

@Injectable()
export class CueService extends DddService {
    constructor(
        private readonly cueRepository: CueRepository,
        private readonly trackRepository: TrackRepository,
        private readonly canvasMediaRepository: CanvasMediaRepository
    ) {
        super();
    }

    async create({
        trackId,
        script,
        startTime,
        endTime,
        audioId,
        audioStartTime,
        audioEndTime,
        startCanvasMediaId,
        endCanvasMediaId,
        startPosition = 0,
        endPosition = startPosition,
        volume,
    }: {
        trackId: number;
        script: string;
        startTime?: number;
        endTime?: number;
        audioId?: number;
        audioStartTime?: number;
        audioEndTime?: number;
        startCanvasMediaId?: number;
        endCanvasMediaId?: number;
        startPosition?: number;
        endPosition?: number;
        volume?: number;
    }) {
        const [track] = await this.trackRepository.find({ id: trackId });

        if (!track) {
            throw new NotFoundException('Track not found.');
        }
        if (track.type === 'record' && !track.characterId) {
            throw new BadRequestException('Cue track must be linked to a character.');
        }
        if (!script.trim()) {
            throw new BadRequestException('Cue script is required.');
        }
        const resolvedStartTime = startTime ?? 0;
        const resolvedEndTime = endTime ?? resolvedStartTime + DEFAULT_PENDING_CUE_DURATION_MS;
        if (!Number.isFinite(resolvedStartTime) || !Number.isFinite(resolvedEndTime) || resolvedEndTime <= resolvedStartTime) {
            throw new BadRequestException('Cue endTime must be greater than startTime.');
        }
        const audio = await this.resolveAudio({ track, audioId });
        this.validateAudioSourceRange({
            audioId,
            audioStartTime,
            audioEndTime,
            audioDuration: audio?.duration,
        });
        this.validatePositions({ startPosition, endPosition });
        const {
            startCanvasMediaId: resolvedStartCanvasMediaId,
            endCanvasMediaId: resolvedEndCanvasMediaId,
            startCanvasMedia,
            endCanvasMedia,
        } = await this.resolveCanvasMedias({
            track,
            startCanvasMediaId,
            endCanvasMediaId: endCanvasMediaId ?? startCanvasMediaId,
        });

        const trimmedScript = script.trim();

        const cue = new Cue({
            script: trimmedScript,
            characterId: track.characterId ?? undefined,
            trackId,
            audioId,
            startCanvasMediaId: resolvedStartCanvasMediaId,
            endCanvasMediaId: resolvedEndCanvasMediaId,
            startTime: resolvedStartTime,
            endTime: resolvedEndTime,
            audioStartTime,
            audioEndTime,
            startPosition,
            endPosition,
            volume,
        });
        cue.startCanvasMedia = startCanvasMedia;
        cue.endCanvasMedia = endCanvasMedia;
        await this.cueRepository.entityManager.save(cue);

        return toCueResponse(cue);
    }

    async list({ trackId }: { trackId: number }) {
        const [track] = await this.trackRepository.find({ id: trackId });

        if (!track) {
            throw new NotFoundException('Track not found.');
        }

        const [cues, total] = await Promise.all([
            this.cueRepository.find({ trackId }, { options: { sort: 'startTime', order: 'ASC' } }),
            this.cueRepository.count({ trackId }),
        ]);
        const items = cues.map(toCueResponse);

        return { items, total };
    }

    async update({
        trackId,
        cueId,
        script,
        startTime,
        endTime,
        audioId,
        audioStartTime,
        audioEndTime,
        startCanvasMediaId,
        endCanvasMediaId,
        startPosition,
        endPosition,
        volume,
    }: {
        trackId: number;
        cueId: number;
        script?: string;
        startTime?: number;
        endTime?: number;
        audioId?: number;
        audioStartTime?: number;
        audioEndTime?: number;
        startCanvasMediaId?: number;
        endCanvasMediaId?: number;
        startPosition?: number;
        endPosition?: number;
        volume?: number;
    }) {
        const [track] = await this.trackRepository.find({ id: trackId });

        if (!track) {
            throw new NotFoundException('Track not found.');
        }
        if (track.type === 'record' && !track.characterId) {
            throw new BadRequestException('Cue track must be linked to a character.');
        }

        const [cue] = await this.cueRepository.find({ id: cueId, trackId });

        if (!cue) {
            throw new NotFoundException('Cue not found.');
        }

        const trimmedScript = script?.trim();
        if (script !== undefined && !trimmedScript) {
            throw new BadRequestException('Cue script is required.');
        }

        const nextStartTime = startTime ?? cue.startTime;
        const nextEndTime = endTime ?? cue.endTime;
        if (!Number.isFinite(nextStartTime) || !Number.isFinite(nextEndTime) || nextEndTime <= nextStartTime) {
            throw new BadRequestException('Cue endTime must be greater than startTime.');
        }
        const nextAudioId = audioId !== undefined ? audioId : (cue.audioId ?? undefined);
        const audio = await this.resolveAudio({ track, audioId: nextAudioId });
        const nextAudioStartTime = audioStartTime !== undefined ? audioStartTime : (cue.audioStartTime ?? undefined);
        const nextAudioEndTime = audioEndTime !== undefined ? audioEndTime : (cue.audioEndTime ?? undefined);
        this.validateAudioSourceRange({
            audioId: nextAudioId,
            audioStartTime: nextAudioStartTime,
            audioEndTime: nextAudioEndTime,
            audioDuration: audio?.duration,
        });
        const nextStartPosition = startPosition ?? cue.startPosition;
        const nextEndPosition = endPosition ?? cue.endPosition;
        this.validatePositions({ startPosition: nextStartPosition, endPosition: nextEndPosition });
        const nextStartCanvasMediaId = startCanvasMediaId ?? cue.startCanvasMediaId;
        const nextEndCanvasMediaId = endCanvasMediaId ?? cue.endCanvasMediaId ?? nextStartCanvasMediaId;
        const {
            startCanvasMediaId: resolvedStartCanvasMediaId,
            endCanvasMediaId: resolvedEndCanvasMediaId,
            startCanvasMedia,
            endCanvasMedia,
        } = await this.resolveCanvasMedias({
            track,
            startCanvasMediaId: nextStartCanvasMediaId,
            endCanvasMediaId: nextEndCanvasMediaId,
        });

        cue.update({
            script: trimmedScript,
            characterId: track.characterId ?? undefined,
            audioId,
            startCanvasMediaId: resolvedStartCanvasMediaId,
            endCanvasMediaId: resolvedEndCanvasMediaId,
            startTime,
            endTime,
            audioStartTime,
            audioEndTime,
            startPosition,
            endPosition,
            volume,
        });
        cue.startCanvasMedia = startCanvasMedia;
        cue.endCanvasMedia = endCanvasMedia;
        await this.cueRepository.save([cue]);
    }

    async split({ trackId, cueId, splitTime }: { trackId: number; cueId: number; splitTime: number }) {
        const [track] = await this.trackRepository.find({ id: trackId });

        if (!track) {
            throw new NotFoundException('Track not found.');
        }

        const [cue] = await this.cueRepository.find({ id: cueId, trackId }, { relations: { audio: true } });

        if (!cue) {
            throw new NotFoundException('Cue not found.');
        }
        if (!cue.audioId) {
            throw new BadRequestException('Only audio cues can be split.');
        }
        if (!Number.isFinite(splitTime) || splitTime <= cue.startTime || splitTime >= cue.endTime) {
            throw new BadRequestException('Cue splitTime must be inside the cue time range.');
        }

        const audioStartTime = cue.audioStartTime ?? 0;
        const audioEndTime = cue.audioEndTime ?? audioStartTime + (cue.endTime - cue.startTime);
        const sourceDuration = audioEndTime - audioStartTime;
        const splitRatio = (splitTime - cue.startTime) / (cue.endTime - cue.startTime);
        const splitAudioTime = Math.round(audioStartTime + sourceDuration * splitRatio);

        this.validateAudioSourceRange({
            audioId: cue.audioId,
            audioStartTime,
            audioEndTime,
            audioDuration: cue.audio?.duration,
        });

        const rightCue = new Cue({
            script: `${cue.script} B`,
            characterId: cue.characterId,
            trackId: cue.trackId,
            audioId: cue.audioId,
            startCanvasMediaId: cue.startCanvasMediaId,
            endCanvasMediaId: cue.endCanvasMediaId,
            startTime: splitTime,
            endTime: cue.endTime,
            audioStartTime: splitAudioTime,
            audioEndTime,
            startPosition: cue.startPosition,
            endPosition: cue.endPosition,
            volume: cue.volume,
        });

        cue.update({
            endTime: splitTime,
            audioStartTime,
            audioEndTime: splitAudioTime,
        });
        await this.cueRepository.entityManager.transaction(async (entityManager) => {
            await entityManager.save(cue);
            await entityManager.save(rightCue);
        });

        return {
            left: toCueResponse(cue),
            right: toCueResponse(rightCue),
        };
    }

    async delete({ trackId, cueId }: { trackId: number; cueId: number }) {
        const [cue] = await this.cueRepository.find({ id: cueId, trackId });

        if (!cue) {
            throw new NotFoundException('Cue not found.');
        }

        await this.cueRepository.softRemove([cue]);
    }

    private validatePositions({ startPosition, endPosition }: { startPosition: number; endPosition: number }) {
        if (
            !Number.isFinite(startPosition) ||
            !Number.isFinite(endPosition) ||
            startPosition < 0 ||
            startPosition > 100 ||
            endPosition < 0 ||
            endPosition > 100
        ) {
            throw new BadRequestException('Cue positions must be between 0 and 100.');
        }
    }

    private validateAudioSourceRange({
        audioId,
        audioStartTime,
        audioEndTime,
        audioDuration,
    }: {
        audioId?: number;
        audioStartTime?: number;
        audioEndTime?: number;
        audioDuration?: number;
    }) {
        if (audioId === undefined) {
            if (audioStartTime !== undefined || audioEndTime !== undefined) {
                throw new BadRequestException('Cue audio source range requires audioId.');
            }

            return;
        }

        if (audioStartTime === undefined && audioEndTime === undefined) {
            return;
        }
        if (
            audioStartTime === undefined ||
            audioEndTime === undefined ||
            !Number.isFinite(audioStartTime) ||
            !Number.isFinite(audioEndTime) ||
            audioStartTime < 0 ||
            audioEndTime <= audioStartTime
        ) {
            throw new BadRequestException('Cue audio source range is invalid.');
        }
        if (typeof audioDuration === 'number' && audioEndTime > audioDuration) {
            throw new BadRequestException('Cue audio source range exceeds audio duration.');
        }
    }

    private async resolveAudio({ track, audioId }: { track: Track; audioId?: number }) {
        if (audioId === undefined) {
            return undefined;
        }
        if (!Number.isInteger(audioId)) {
            throw new BadRequestException('Cue audioId must be an integer.');
        }

        const audio = await this.cueRepository.entityManager.findOne(Audio, {
            where: {
                id: audioId,
                episodeId: track.episodeId,
            },
        });

        if (!audio) {
            throw new NotFoundException('Cue audio not found.');
        }

        return audio;
    }

    private async resolveCanvasMedias({
        track,
        startCanvasMediaId,
        endCanvasMediaId,
    }: {
        track: Track;
        startCanvasMediaId?: number;
        endCanvasMediaId?: number;
    }) {
        const ids = Array.from(
            new Set(
                [startCanvasMediaId, endCanvasMediaId].filter(
                    (id): id is number => typeof id === 'number'
                )
            )
        );

        if (ids.length === 0) {
            return {
                startCanvasMediaId: undefined,
                endCanvasMediaId: undefined,
                startCanvasMedia: undefined,
                endCanvasMedia: undefined,
            };
        }
        if (ids.some((id) => !Number.isInteger(id))) {
            throw new BadRequestException('Cue canvasMediaId must be an integer.');
        }

        const canvasMedias = await this.canvasMediaRepository.find(
            { id: checkInValue(ids) },
            { relations: { canvas: true } }
        );
        if (canvasMedias.length !== ids.length) {
            throw new NotFoundException('Cue canvas media not found.');
        }

        const canvasMediaById = new Map(canvasMedias.map((canvasMedia) => [canvasMedia.id, canvasMedia]));
        for (const canvasMedia of canvasMedias) {
            if (canvasMedia.canvas.episodeId !== track.episodeId) {
                throw new BadRequestException('Cue canvas media must belong to the track episode.');
            }
        }

        return {
            startCanvasMediaId,
            endCanvasMediaId,
            startCanvasMedia: startCanvasMediaId ? canvasMediaById.get(startCanvasMediaId) : undefined,
            endCanvasMedia: endCanvasMediaId ? canvasMediaById.get(endCanvasMediaId) : undefined,
        } satisfies {
            startCanvasMediaId?: number;
            endCanvasMediaId?: number;
            startCanvasMedia?: CanvasMedia;
            endCanvasMedia?: CanvasMedia;
        };
    }
}

function toCueResponse(cue: Cue) {
    return {
        id: cue.id,
        script: cue.script,
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
        volume: cue.volume,
    };
}
