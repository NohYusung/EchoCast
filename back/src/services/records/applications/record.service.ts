import { Injectable } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Record, type RecordStatus } from '../domain/record.entity';
import { RecordRepository } from '../repository/record.repository';

@Injectable()
export class RecordService extends DddService {
    constructor(private readonly recordRepository: RecordRepository) {
        super();
    }

    async create({
        cueId,
        artistId,
        status,
        audioUrl,
        durationMs,
        volume,
    }: {
        cueId: number;
        artistId: number;
        status?: RecordStatus;
        audioUrl: string;
        durationMs: number;
        volume?: number;
    }) {
        const record = new Record({
            cueId,
            artistId,
            status,
            audioUrl,
            durationMs,
            volume,
        });

        await this.recordRepository.save([record]);

        return {
            id: record.id,
            cueId: record.cueId,
            artistId: record.artistId,
            status: record.status,
            audioUrl: record.audioUrl,
            durationMs: record.durationMs,
            volume: record.volume,
        };
    }
}
