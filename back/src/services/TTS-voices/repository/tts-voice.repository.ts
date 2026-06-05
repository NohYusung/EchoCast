import { Injectable } from "@nestjs/common";
import { DddRepository } from "../../../libs/ddd";
import { stripUndefined } from "../../../libs/utils/helper";
import type { FindManyOptions } from "typeorm";
import { TtsVoice } from "../domain/tts-voice.entity";

@Injectable()
export class TtsVoiceRepository extends DddRepository<TtsVoice> {
  entityClass = TtsVoice;

  async find(
    conditions: {
      id?: string;
      provider?: string;
      voiceName?: string;
      voiceKey?: string;
      languageCode?: string;
      fileUrl?: string;
      scriptId?: string;
    },
    options?: Omit<FindManyOptions<TtsVoice>, "where">,
  ) {
    return this.entityManager.find(this.entityClass, {
      where: stripUndefined<TtsVoice>({
        id: conditions.id,
        provider: conditions.provider,
        voiceName: conditions.voiceName,
        voiceKey: conditions.voiceKey,
        languageCode: conditions.languageCode,
        fileUrl: conditions.fileUrl,
        scriptId: conditions.scriptId,
      }),
      ...options,
    });
  }

  async count(conditions: {
    id?: string;
    provider?: string;
    voiceName?: string;
    voiceKey?: string;
    languageCode?: string;
    fileUrl?: string;
    scriptId?: string;
  }) {
    return this.entityManager.count(this.entityClass, {
      where: stripUndefined<TtsVoice>({
        id: conditions.id,
        provider: conditions.provider,
        voiceName: conditions.voiceName,
        voiceKey: conditions.voiceKey,
        languageCode: conditions.languageCode,
        fileUrl: conditions.fileUrl,
        scriptId: conditions.scriptId,
      }),
    });
  }
}
