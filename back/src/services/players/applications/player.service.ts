import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { checkInValue } from '../../../libs/utils/typeorm';
import { DddService } from '../../../libs/ddd';
import { AnchorRepository } from '../../anchors/repository/anchor.repository';
import { AudioRepository } from '../../audios/repository/audio.repository';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import type { Cue } from '../../cues/domain/cue.entity';
import { CueRepository } from '../../cues/repository/cue.repository';
import { EpisodeRepository } from '../../episodes/repository/episode.repository';
import { Record as RecordEntity } from '../../records/domain/record.entity';
import { RecordRepository } from '../../records/repository/record.repository';
import { ScrollRepository } from '../../scrolls/repository/scroll.repository';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { PlayerInfoResponseDto, type AssignedCue } from '../controllers/dto';

// `cue is ...`는 boolean 반환과 동시에 true 분기에서 cue 타입을 좁히는 TypeScript 타입 가드다.
// `typeof ... === 'number'` 런타임 검증으로 nullable 시간값을 숫자 필드로 확정한다.
function hasAssignedCueTime(cue: Cue): cue is AssignedCue {
    return typeof cue.startTime === 'number' && typeof cue.endTime === 'number';
}

function assertCanvasMediaIndexes(canvasMedias: Array<{ id: number; index?: number }>) {
    const missingIndexCanvasMedia = canvasMedias.find((canvasMedia) => typeof canvasMedia.index !== 'number');
    if (missingIndexCanvasMedia) {
        throw new InternalServerErrorException(
            `CanvasMedia index가 누락되었습니다. canvasMediaId=${missingIndexCanvasMedia.id}`
        );
    }
}

@Injectable()
export class PlayerService extends DddService {
    constructor(
        private readonly episodeRepository: EpisodeRepository,
        private readonly trackRepository: TrackRepository,
        private readonly canvasRepository: CanvasRepository,
        private readonly cueRepository: CueRepository,
        private readonly audioRepository: AudioRepository,
        private readonly anchorRepository: AnchorRepository,
        private readonly scrollRepository: ScrollRepository,
        private readonly recordRepository: RecordRepository
    ) {
        super();
    }

    async getPlayerInfo({ episodeId, canvasId }: { episodeId: number; canvasId?: number }) {
        const [episode] = await this.episodeRepository.find({ id: episodeId }, { relations: { product: true } });
        if (!episode) {
            throw new NotFoundException('에피소드를 찾을 수 없습니다.');
        }

        // canvasId 형식 검증은 DTO에서 처리하고, service는 재생 대상 canvas 결정만 담당한다.
        // 요청 canvasId가 없으면 episode.defaultCanvasId를 대표 canvas로 사용한다.
        const selectedCanvasId = canvasId ?? episode.defaultCanvasId;
        if (typeof selectedCanvasId !== 'number') {
            throw new NotFoundException('대표 캔버스를 찾을 수 없습니다.');
        }

        const [tracks, canvases, audios] = await Promise.all([
            this.trackRepository.find({ episodeId }, { options: { sort: 'id', order: 'ASC' } }),
            this.canvasRepository.find(
                { id: selectedCanvasId, episodeId },
                { relations: { canvasMedias: { media: true } } }
            ),
            this.audioRepository.find({ episodeId }, { options: { sort: 'id', order: 'ASC' } }),
        ]);
        const [canvas] = canvases;
        if (!canvas) {
            throw new NotFoundException('캔버스를 찾을 수 없습니다.');
        }

        assertCanvasMediaIndexes(canvas.canvasMedias);
        canvas.canvasMedias = [...canvas.canvasMedias].sort(
            (a, b) => a.index! - b.index! || a.media.id - b.media.id
        );
        const trackIds = tracks.map((track) => track.id);
        const [cues, anchors, scrolls] =
            trackIds.length > 0
                ? await Promise.all([
                      this.cueRepository.find(
                          { trackId: checkInValue(trackIds) },
                          { options: { sort: 'startTime', order: 'ASC' } }
                      ),
                      this.anchorRepository.find(
                          { trackId: checkInValue(trackIds) },
                          { options: { sort: 'time', order: 'ASC' } }
                      ),
                      this.scrollRepository.find(
                          { trackId: checkInValue(trackIds) },
                          { relations: { startAnchor: true, endAnchor: true } }
                      ),
                  ])
                : [[], [], []];
        cues.sort(
            (a, b) => (a.startTime ?? Number.MAX_SAFE_INTEGER) - (b.startTime ?? Number.MAX_SAFE_INTEGER) || a.id - b.id
        );
        anchors.sort((a, b) => a.time - b.time || a.id - b.id);
        scrolls.sort((a, b) => (a.startAnchor?.time ?? 0) - (b.startAnchor?.time ?? 0) || a.id - b.id);
        const scheduledCues = cues.filter(hasAssignedCueTime);
        const cueIds = scheduledCues.map((cue) => cue.id);
        const records: RecordEntity[] =
            cueIds.length > 0
                ? await this.recordRepository.find(
                      { cueId: checkInValue(cueIds) },
                      { options: { sort: 'cueId', order: 'ASC' } }
                  )
                : [];
        records.sort((a, b) => a.cueId - b.cueId || a.id - b.id);

        return PlayerInfoResponseDto.from({
            episode,
            tracks,
            canvas,
            cues: scheduledCues,
            audios,
            anchors,
            scrolls,
            records,
        });
    }
}
