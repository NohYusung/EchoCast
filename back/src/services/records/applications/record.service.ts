import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Audio } from '../../audios/domain/audio.entity';
import { AudioRepository } from '../../audios/repository/audio.repository';
import { CueRepository } from '../../cues/repository/cue.repository';
import { Record } from '../domain/record.entity';
import { RecordRepository } from '../repository/record.repository';

@Injectable()
export class RecordService extends DddService {
    constructor(
        private readonly recordRepository: RecordRepository,
        private readonly audioRepository: AudioRepository,
        private readonly cueRepository: CueRepository
    ) {
        super();
    }

    async create({
        cueId,
        artistId,
        audioId,
        recordUrl,
        duration,
        isAccepted,
    }: {
        cueId: number;
        artistId?: number | null;
        audioId?: number;
        recordUrl?: string;
        duration?: number;
        isAccepted?: boolean;
    }) {
        const [cue] = await this.cueRepository.find({ id: cueId }, { relations: { track: true } });
        if (!cue) {
            throw new NotFoundException('큐를 찾을 수 없습니다.');
        }

        const record = await this.recordRepository.entityManager.transaction(async (entityManager) => {
            let audio: Audio | null = null;
            if (typeof audioId === 'number') {
                audio = await entityManager.findOne(Audio, { where: { id: audioId, episodeId: cue.track.episodeId } });
                if (!audio) {
                    throw new NotFoundException('녹음 오디오를 찾을 수 없습니다.');
                }
                if (audio.audioType !== 'record') {
                    throw new BadRequestException('record는 record 타입 오디오만 연결할 수 있습니다.');
                }
                const linkedRecord = await entityManager.findOne(Record, { where: { audioId: audio.id } });
                if (linkedRecord) {
                    throw new BadRequestException('이미 다른 녹음에 연결된 record 오디오입니다.');
                }
            } else if (recordUrl) {
                audio = await entityManager.save(
                    new Audio({
                        episodeId: cue.track.episodeId,
                        audioType: 'record',
                        name: recordUrl.split('/').filter(Boolean).pop() ?? recordUrl,
                        audioUrl: recordUrl,
                        duration,
                    })
                );
            } else {
                throw new BadRequestException('recordUrl 또는 audioId가 필요합니다.');
            }

            if (isAccepted === true) {
                const acceptedRecords = await entityManager.find(Record, {
                    where: {
                        cueId,
                        isAccepted: true,
                    },
                });
                acceptedRecords.forEach((acceptedRecord) => acceptedRecord.update({ isAccepted: false }));
                if (acceptedRecords.length > 0) {
                    await entityManager.save(acceptedRecords);
                }
            }

            const record = new Record({
                cueId,
                artistId,
                audioId: audio.id,
                isAccepted,
            });
            await entityManager.save(record);
            record.audio = audio;

            return record;
        });

        return toRecordResponse(record);
    }

    async list() {
        const [records, total] = await Promise.all([
            this.recordRepository.find({}, { relations: { audio: true }, options: { sort: 'id', order: 'ASC' } }),
            this.recordRepository.count({}),
        ]);
        const items = records.map(toRecordResponse);

        return { items, total };
    }

    async update({
        recordId,
        cueId,
        artistId,
        audioId,
        recordUrl,
        duration,
        isAccepted,
    }: {
        recordId: number;
        cueId?: number;
        artistId?: number | null;
        audioId?: number;
        recordUrl?: string;
        duration?: number;
        isAccepted?: boolean;
    }) {
        const [record] = await this.recordRepository.find({ id: recordId }, { relations: { audio: true } });

        if (!record) {
            throw new NotFoundException('녹음을 찾을 수 없습니다.');
        }

        let nextAudioId = audioId;
        if (typeof audioId === 'number') {
            const [cue] = await this.cueRepository.find({ id: cueId ?? record.cueId }, { relations: { track: true } });
            if (!cue) {
                throw new NotFoundException('큐를 찾을 수 없습니다.');
            }
            const [audio] = await this.audioRepository.find({ id: audioId, audioType: 'record' });
            if (!audio) {
                throw new NotFoundException('녹음 오디오를 찾을 수 없습니다.');
            }
            if (audio.episodeId !== cue.track.episodeId) {
                throw new BadRequestException('record는 같은 에피소드의 record 타입 오디오만 연결할 수 있습니다.');
            }
            const linkedRecords = await this.recordRepository.find({ audioId });
            if (linkedRecords.some((linkedRecord) => linkedRecord.id !== recordId)) {
                throw new BadRequestException('이미 다른 녹음에 연결된 record 오디오입니다.');
            }
            record.audio = audio;
        } else if (recordUrl || typeof duration === 'number') {
            if (!record.audio) {
                const [cue] = await this.cueRepository.find({ id: cueId ?? record.cueId }, { relations: { track: true } });
                if (!cue) {
                    throw new NotFoundException('큐를 찾을 수 없습니다.');
                }
                const audio = new Audio({
                    episodeId: cue.track.episodeId,
                    audioType: 'record',
                    name: recordUrl?.split('/').filter(Boolean).pop() ?? `record-${record.id}`,
                    audioUrl: recordUrl ?? '',
                    duration,
                });
                await this.audioRepository.save([audio]);
                record.audio = audio;
                nextAudioId = audio.id;
            } else {
                if (record.audio.audioType !== 'record') {
                    throw new BadRequestException('record는 record 타입 오디오만 연결할 수 있습니다.');
                }
                record.audio.update({
                    ...(recordUrl ? { name: recordUrl.split('/').filter(Boolean).pop() ?? recordUrl, audioUrl: recordUrl } : {}),
                    ...(typeof duration === 'number' ? { duration } : {}),
                });
                await this.audioRepository.save([record.audio]);
            }
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

        record.update({ cueId, artistId, audioId: nextAudioId, isAccepted });
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
        audioId: record.audioId,
        recordUrl: record.audio?.audioUrl,
        duration: record.audio?.duration ?? undefined,
        isAccepted: record.isAccepted,
    };
}
