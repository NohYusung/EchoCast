import { Injectable } from '@nestjs/common';
import type { FindOperator } from 'typeorm';
import { DddRepository } from '../../../libs/ddd';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { stripUndefined } from '../../../libs/utils/helper';
import { TtsVoice } from '../domain/tts-voice.entity';

@Injectable()
export class TtsVoiceRepository extends DddRepository<TtsVoice> {
    entityClass = TtsVoice;

    async find(
        conditions: {
            id?: number | FindOperator<number>;
            provider?: string;
            voiceName?: string;
            voiceKey?: string;
            languageCode?: string;
            fileUrl?: string;
        },
        options?: TypeormRelationOptions<TtsVoice>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<TtsVoice>({
                id: conditions.id,
                provider: conditions.provider,
                voiceName: conditions.voiceName,
                voiceKey: conditions.voiceKey,
                languageCode: conditions.languageCode,
                fileUrl: conditions.fileUrl,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        provider?: string;
        voiceName?: string;
        voiceKey?: string;
        languageCode?: string;
        fileUrl?: string;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<TtsVoice>({
                id: conditions.id,
                provider: conditions.provider,
                voiceName: conditions.voiceName,
                voiceKey: conditions.voiceKey,
                languageCode: conditions.languageCode,
                fileUrl: conditions.fileUrl,
            }),
        });
    }
}
