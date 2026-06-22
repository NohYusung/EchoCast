import { Injectable } from '@nestjs/common';
import type { FindOperator } from 'typeorm';
import { DddRepository } from '../../../libs/ddd';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { stripUndefined } from '../../../libs/utils/helper';
import { Cue } from '../domain/cue.entity';

@Injectable()
export class CueRepository extends DddRepository<Cue> {
    entityClass = Cue;

    async find(
        conditions: {
            id?: number;
            scriptId?: number | FindOperator<number>;
            characterId?: number;
            trackId?: number | FindOperator<number>;
            audioId?: number | FindOperator<number>;
            startCanvasMediaId?: number | FindOperator<number>;
            endCanvasMediaId?: number | FindOperator<number>;
            startTime?: number;
            endTime?: number;
            audioStartTime?: number;
            audioEndTime?: number;
            startPosition?: number;
            endPosition?: number;
        },
        options?: TypeormRelationOptions<Cue>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Cue>({
                id: conditions.id,
                scriptId: conditions.scriptId,
                characterId: conditions.characterId,
                trackId: conditions.trackId,
                audioId: conditions.audioId,
                startCanvasMediaId: conditions.startCanvasMediaId,
                endCanvasMediaId: conditions.endCanvasMediaId,
                startTime: conditions.startTime,
                endTime: conditions.endTime,
                audioStartTime: conditions.audioStartTime,
                audioEndTime: conditions.audioEndTime,
                startPosition: conditions.startPosition,
                endPosition: conditions.endPosition,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        scriptId?: number;
        characterId?: number;
        trackId?: number;
        audioId?: number;
        startCanvasMediaId?: number;
        endCanvasMediaId?: number;
        startTime?: number;
        endTime?: number;
        audioStartTime?: number;
        audioEndTime?: number;
        startPosition?: number;
        endPosition?: number;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Cue>({
                id: conditions.id,
                scriptId: conditions.scriptId,
                characterId: conditions.characterId,
                trackId: conditions.trackId,
                audioId: conditions.audioId,
                startCanvasMediaId: conditions.startCanvasMediaId,
                endCanvasMediaId: conditions.endCanvasMediaId,
                startTime: conditions.startTime,
                endTime: conditions.endTime,
                audioStartTime: conditions.audioStartTime,
                audioEndTime: conditions.audioEndTime,
                startPosition: conditions.startPosition,
                endPosition: conditions.endPosition,
            }),
        });
    }
}
