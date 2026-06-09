import { Injectable } from '@nestjs/common';
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
            scriptId?: number;
            characterId?: number;
            trackId?: number;
            startTime?: number;
            endTime?: number;
            ttsVoiceId?: number;
        },
        options?: TypeormRelationOptions<Cue>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Cue>({
                id: conditions.id,
                scriptId: conditions.scriptId,
                characterId: conditions.characterId,
                trackId: conditions.trackId,
                startTime: conditions.startTime,
                endTime: conditions.endTime,
                ttsVoiceId: conditions.ttsVoiceId,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        scriptId?: number;
        characterId?: number;
        trackId?: number;
        startTime?: number;
        endTime?: number;
        ttsVoiceId?: number;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Cue>({
                id: conditions.id,
                scriptId: conditions.scriptId,
                characterId: conditions.characterId,
                trackId: conditions.trackId,
                startTime: conditions.startTime,
                endTime: conditions.endTime,
                ttsVoiceId: conditions.ttsVoiceId,
            }),
        });
    }
}
