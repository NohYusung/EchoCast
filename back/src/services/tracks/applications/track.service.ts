import { Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { TrackResponseDto } from '../controllers/dto';
import { Track, type TrackType } from '../domain/track.entity';
import { TrackRepository } from '../repository/track.repository';

@Injectable()
export class TrackService extends DddService {
    constructor(private readonly trackRepository: TrackRepository) {
        super();
    }

    async create({
        episodeId,
        name,
        type,
        characterId,
        isMuted,
    }: {
        episodeId: number;
        name: string;
        type: TrackType;
        characterId?: number;
        isMuted?: boolean;
    }) {
        const track = new Track({
            episodeId,
            name,
            type,
            characterId,
            isMuted,
        });

        await this.trackRepository.save([track]);
        return {
            id: track.id,
            episodeId: track.episodeId,
            name: track.name,
            type: track.type,
            characterId: track.characterId,
            isMuted: track.isMuted,
        };
    }

    async list({ episodeId }: { episodeId: number }) {
        const [tracks, total] = await Promise.all([
            this.trackRepository.find(
                { episodeId },
                { relations: { cues: { audio: true }, scrolls: { startAnchor: true, endAnchor: true } } }
            ),
            this.trackRepository.count({ episodeId }),
        ]);
        const items = tracks.map((track) => {
            const item = track.toInstance(TrackResponseDto);
            item.scrolls = [...(track.scrolls ?? [])]
                .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0) || a.id - b.id)
                .map((scroll) => ({
                    id: scroll.id,
                    trackId: scroll.trackId,
                    startAnchorId: scroll.startAnchorId,
                    endAnchorId: scroll.endAnchorId,
                    canvasId: scroll.canvasId,
                    startIndex: scroll.startIndex,
                    endIndex: scroll.endIndex,
                    startTime: scroll.startTime,
                    endTime: scroll.endTime,
                    startPosition: scroll.startPosition,
                    endPosition: scroll.endPosition,
                }));
            return item;
        });

        return { items, total };
    }

    async delete({ episodeId, trackId }: { episodeId: number; trackId: number }) {
        const [track] = await this.trackRepository.find({ id: trackId, episodeId });

        if (!track) {
            throw new NotFoundException('트랙을 찾을 수 없습니다.');
        }

        await this.trackRepository.softRemove([track]);
    }
}
