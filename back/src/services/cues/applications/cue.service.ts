import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { Cue } from '../domain/cue.entity';
import { CueRepository } from '../repository/cue.repository';

@Injectable()
export class CueService extends DddService {
    constructor(
        private readonly cueRepository: CueRepository,
        private readonly trackRepository: TrackRepository
    ) {
        super();
    }

    async create({
        trackId,
        script,
        startTime,
        endTime,
        ttsVoiceId,
        volume,
    }: {
        trackId: number;
        script: string;
        startTime: number;
        endTime: number;
        ttsVoiceId?: number;
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
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
            throw new BadRequestException('Cue endTime must be greater than startTime.');
        }

        const trimmedScript = script.trim();

        const cue = new Cue({
            script: trimmedScript,
            characterId: track.characterId ?? undefined,
            trackId,
            startTime,
            endTime,
            ttsVoiceId,
            volume,
        });
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
        ttsVoiceId,
        volume,
    }: {
        trackId: number;
        cueId: number;
        script?: string;
        startTime?: number;
        endTime?: number;
        ttsVoiceId?: number;
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

        cue.update({
            script: trimmedScript,
            characterId: track.characterId ?? undefined,
            startTime,
            endTime,
            ttsVoiceId,
            volume,
        });
        await this.cueRepository.save([cue]);
    }

    async delete({ trackId, cueId }: { trackId: number; cueId: number }) {
        const [cue] = await this.cueRepository.find({ id: cueId, trackId });

        if (!cue) {
            throw new NotFoundException('Cue not found.');
        }

        await this.cueRepository.softRemove([cue]);
    }
}

function toCueResponse(cue: Cue) {
    return {
        id: cue.id,
        script: cue.script,
        characterId: cue.characterId,
        trackId: cue.trackId,
        audioId: cue.audioId,
        startTime: cue.startTime,
        endTime: cue.endTime,
        ttsVoiceId: cue.ttsVoiceId,
        volume: cue.volume,
    };
}
