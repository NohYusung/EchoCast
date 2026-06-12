import { Injectable } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Record } from '../domain/record.entity';
import { RecordRepository } from '../repository/record.repository';

@Injectable()
export class RecordService extends DddService {
    constructor(private readonly recordRepository: RecordRepository) {
        super();
    }

    async create({
        cueId,
        artistId,
        audioUrl,
        duration,
        volume,
    }: {
        cueId: number;
        artistId: number;
        audioUrl: string;
        duration?: number;
        volume?: number;
    }) {
        const record = new Record({
            cueId,
            artistId,
            audioUrl,
            duration,
            volume,
        });

        await this.recordRepository.save([record]);

        return {
            id: record.id,
            cueId: record.cueId,
            artistId: record.artistId,
            audioUrl: record.audioUrl,
            duration: record.duration ?? undefined,
            volume: record.volume,
        };
    }
}
