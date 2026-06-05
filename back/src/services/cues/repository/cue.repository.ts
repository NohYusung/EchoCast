import { Injectable } from "@nestjs/common";
import { DddRepository } from "../../../libs/ddd";
import { stripUndefined } from "../../../libs/utils/helper";
import type { FindManyOptions } from "typeorm";
import { Cue } from "../domain/cue.entity";

@Injectable()
export class CueRepository extends DddRepository<Cue> {
  entityClass = Cue;

  async find(
    conditions: {
      id?: string;
      episodeId?: string;
      scriptId?: string;
      characterId?: string;
      trackId?: string;
      startTime?: number;
      endTime?: number;
      ttsVoiceId?: string;
      ttsUrl?: string;
    },
    options?: Omit<FindManyOptions<Cue>, "where">,
  ) {
    return this.entityManager.find(this.entityClass, {
      where: stripUndefined<Cue>({
        id: conditions.id,
        episodeId: conditions.episodeId,
        scriptId: conditions.scriptId,
        characterId: conditions.characterId,
        trackId: conditions.trackId,
        startTime: conditions.startTime,
        endTime: conditions.endTime,
        ttsVoiceId: conditions.ttsVoiceId,
        ttsUrl: conditions.ttsUrl,
      }),
      ...options,
    });
  }

  async count(conditions: {
    id?: string;
    episodeId?: string;
    scriptId?: string;
    characterId?: string;
    trackId?: string;
    startTime?: number;
    endTime?: number;
    ttsVoiceId?: string;
    ttsUrl?: string;
  }) {
    return this.entityManager.count(this.entityClass, {
      where: stripUndefined<Cue>({
        id: conditions.id,
        episodeId: conditions.episodeId,
        scriptId: conditions.scriptId,
        characterId: conditions.characterId,
        trackId: conditions.trackId,
        startTime: conditions.startTime,
        endTime: conditions.endTime,
        ttsVoiceId: conditions.ttsVoiceId,
        ttsUrl: conditions.ttsUrl,
      }),
    });
  }
}
