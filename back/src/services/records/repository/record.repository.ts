import { Injectable } from '@nestjs/common';
import type { FindOperator } from 'typeorm';
import { DddRepository } from '../../../libs/ddd';
import { stripUndefined } from '../../../libs/utils/helper';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { Record, type RecordStatus } from '../domain/record.entity';

@Injectable()
export class RecordRepository extends DddRepository<Record> {
    entityClass = Record;

    async find(
        conditions: {
            id?: number;
            cueId?: number | FindOperator<number>;
            artistId?: number;
            status?: RecordStatus;
            audioUrl?: string;
            durationMs?: number;
            volume?: number;
        },
        options?: TypeormRelationOptions<Record>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Record>({
                id: conditions.id,
                cueId: conditions.cueId,
                artistId: conditions.artistId,
                status: conditions.status,
                audioUrl: conditions.audioUrl,
                durationMs: conditions.durationMs,
                volume: conditions.volume,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        cueId?: number;
        artistId?: number;
        status?: RecordStatus;
        audioUrl?: string;
        durationMs?: number;
        volume?: number;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Record>({
                id: conditions.id,
                cueId: conditions.cueId,
                artistId: conditions.artistId,
                status: conditions.status,
                audioUrl: conditions.audioUrl,
                durationMs: conditions.durationMs,
                volume: conditions.volume,
            }),
        });
    }
}
