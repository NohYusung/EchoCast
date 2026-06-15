import { Injectable, NotFoundException } from '@nestjs/common';
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
        recordUrl,
        duration,
        volume,
        isAccepted,
    }: {
        cueId: number;
        artistId: number;
        recordUrl: string;
        duration?: number;
        volume?: number;
        isAccepted?: boolean;
    }) {
        const record = new Record({
            cueId,
            artistId,
            recordUrl,
            duration,
            volume,
            isAccepted,
        });

        if (isAccepted === true) {
            const acceptedRecords = await this.recordRepository.find({ cueId, isAccepted: true });
            acceptedRecords.forEach((acceptedRecord) => acceptedRecord.update({ isAccepted: false }));
            if (acceptedRecords.length > 0) {
                await this.recordRepository.save(acceptedRecords);
            }
        }

        await this.recordRepository.save([record]);

        return toRecordResponse(record);
    }

    async list() {
        const [records, total] = await Promise.all([
            this.recordRepository.find({}, { options: { sort: 'id', order: 'ASC' } }),
            this.recordRepository.count({}),
        ]);
        const items = records.map(toRecordResponse);

        return { items, total };
    }

    async update({
        recordId,
        cueId,
        artistId,
        recordUrl,
        duration,
        volume,
        isAccepted,
    }: {
        recordId: number;
        cueId?: number;
        artistId?: number;
        recordUrl?: string;
        duration?: number;
        volume?: number;
        isAccepted?: boolean;
    }) {
        const [record] = await this.recordRepository.find({ id: recordId });

        if (!record) {
            throw new NotFoundException('녹음을 찾을 수 없습니다.');
        }

        if (isAccepted === true) {
            const targetCueId = cueId ?? record.cueId;
            const acceptedRecords = (await this.recordRepository.find({ cueId: targetCueId, isAccepted: true })).filter(
                (acceptedRecord) => acceptedRecord.id !== recordId
            );
            acceptedRecords.forEach((acceptedRecord) => acceptedRecord.update({ isAccepted: false }));
            if (acceptedRecords.length > 0) {
                await this.recordRepository.save(acceptedRecords);
            }
        }

        record.update({ cueId, artistId, recordUrl, duration, volume, isAccepted });
        await this.recordRepository.save([record]);
    }

    async delete({ recordId }: { recordId: number }) {
        const [record] = await this.recordRepository.find({ id: recordId });

        if (!record) {
            throw new NotFoundException('녹음을 찾을 수 없습니다.');
        }

        await this.recordRepository.softRemove([record]);
    }
}

function toRecordResponse(record: Record) {
    return {
        id: record.id,
        cueId: record.cueId,
        artistId: record.artistId,
        recordUrl: record.recordUrl,
        duration: record.duration ?? undefined,
        volume: record.volume,
        isAccepted: record.isAccepted,
    };
}
