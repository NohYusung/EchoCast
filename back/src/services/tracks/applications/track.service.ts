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
                { relations: { cues: { audio: true, scriptRef: true }, scrolls: { startAnchor: true, endAnchor: true } } }
            ),
            this.trackRepository.count({ episodeId }),
        ]);
        const items = tracks.map((track) => {
            const item = track.toInstance(TrackResponseDto);
            item.cues = [...(track.cues ?? [])]
                .sort((a, b) => (a.startTime ?? Number.MAX_SAFE_INTEGER) - (b.startTime ?? Number.MAX_SAFE_INTEGER) || a.id - b.id)
                .map((cue) => ({
                    id: cue.id,
                    scriptId: cue.scriptId ?? undefined,
                    script: cue.scriptRef?.line ?? '',
                    duration: cue.scriptRef?.duration ?? undefined,
                    characterId: cue.characterId,
                    trackId: cue.trackId,
                    audioId: cue.audioId ?? undefined,
                    startCanvasMediaId: cue.startCanvasMediaId,
                    endCanvasMediaId: cue.endCanvasMediaId,
                    audio: cue.audio
                        ? {
                              id: cue.audio.id,
                              audioType: cue.audio.audioType,
                              name: cue.audio.name,
                              audioUrl: cue.audio.audioUrl,
                              duration: cue.audio.duration,
                          }
                        : undefined,
                    startTime: cue.startTime,
                    endTime: cue.endTime,
                    audioStartTime: cue.audioStartTime,
                    audioEndTime: cue.audioEndTime,
                    startPosition: cue.startPosition,
                    endPosition: cue.endPosition,
                    volume: cue.volume,
                }));
            item.scrolls = [...(track.scrolls ?? [])]
                .sort((a, b) => (a.startAnchor?.time ?? 0) - (b.startAnchor?.time ?? 0) || a.id - b.id)
                .map((scroll) => ({
                    id: scroll.id,
                    trackId: scroll.trackId,
                    startAnchorId: scroll.startAnchorId,
                    endAnchorId: scroll.endAnchorId,
                    canvasId: scroll.startAnchor?.canvasId ?? scroll.endAnchor?.canvasId,
                    startIndex: scroll.startAnchor?.index,
                    endIndex: scroll.endAnchor?.index,
                    startTime: scroll.startAnchor?.time,
                    endTime: scroll.endAnchor?.time,
                    startPosition: scroll.startAnchor?.position,
                    endPosition: scroll.endAnchor?.position,
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
