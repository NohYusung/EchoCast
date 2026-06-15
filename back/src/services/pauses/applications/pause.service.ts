import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Anchor } from '../../anchors/domain/anchor.entity';
import { AnchorRepository } from '../../anchors/repository/anchor.repository';
import { ScrollRepository } from '../../scrolls/repository/scroll.repository';
import { Pause } from '../domain/pause.entity';
import { PauseRepository } from '../repository/pause.repository';

function toPauseResponse(pause: Pause) {
    return {
        id: pause.id,
        trackId: pause.trackId,
        anchorId: pause.anchorId,
        duration: pause.duration,
        canvasId: pause.canvasId,
        index: pause.index,
        time: pause.time,
        position: pause.position,
    };
}

@Injectable()
export class PauseService extends DddService {
    constructor(
        private readonly pauseRepository: PauseRepository,
        private readonly anchorRepository: AnchorRepository,
        private readonly scrollRepository?: ScrollRepository
    ) {
        super();
    }

    async create({
        trackId,
        anchorId,
        duration,
    }: {
        trackId: number;
        anchorId: number;
        duration: number;
    }) {
        this.validateDuration({ duration });

        const anchor = await this.getPauseAnchor({ trackId, anchorId });
        await this.validateAnchorEventAvailability({ trackId, anchorId });
        const pause = new Pause({
            trackId,
            anchorId,
            duration,
        });
        pause.anchor = anchor;

        await this.pauseRepository.save([pause]);

        return toPauseResponse(pause);
    }

    async list({ trackId }: { trackId: number }) {
        const [pauses, total] = await Promise.all([
            this.pauseRepository.find({ trackId }, { relations: { anchor: true } }),
            this.pauseRepository.count({ trackId }),
        ]);
        const items = pauses
            .sort((a, b) => (a.time ?? 0) - (b.time ?? 0) || a.id - b.id)
            .map((pause) => toPauseResponse(pause));

        return { items, total };
    }

    async update({
        trackId,
        pauseId,
        anchorId,
        duration,
    }: {
        trackId: number;
        pauseId: number;
        anchorId?: number;
        duration?: number;
    }) {
        const [pause] = await this.pauseRepository.find({ id: pauseId, trackId }, { relations: { anchor: true } });

        if (!pause) {
            throw new NotFoundException('일시정지를 찾을 수 없습니다.');
        }
        if (duration !== undefined) {
            this.validateDuration({ duration });
        }

        const nextAnchorId = anchorId ?? pause.anchorId;
        const anchor = await this.getPauseAnchor({ trackId, anchorId: nextAnchorId });
        await this.validateAnchorEventAvailability({ trackId, anchorId: nextAnchorId, pauseId });

        pause.update({ anchorId, duration });
        pause.anchor = anchor;
        await this.pauseRepository.save([pause]);
    }

    async delete({ trackId, pauseId }: { trackId: number; pauseId: number }) {
        const [pause] = await this.pauseRepository.find({ id: pauseId, trackId });

        if (!pause) {
            throw new NotFoundException('일시정지를 찾을 수 없습니다.');
        }

        await this.pauseRepository.softRemove([pause]);
    }

    private validateDuration({ duration }: { duration: number }) {
        if (!Number.isFinite(duration) || duration <= 0) {
            throw new BadRequestException('일시정지 duration은 0보다 커야 합니다.');
        }
    }

    private async getPauseAnchor({ trackId, anchorId }: { trackId: number; anchorId: number }): Promise<Anchor> {
        if (!Number.isInteger(anchorId)) {
            throw new BadRequestException('일시정지 anchorId가 필요합니다.');
        }

        const [anchor] = await this.anchorRepository.find({ id: anchorId });

        if (!anchor) {
            throw new NotFoundException('일시정지 앵커를 찾을 수 없습니다.');
        }
        if (anchor.trackId !== trackId) {
            throw new BadRequestException('일시정지 앵커는 대상 트랙에 속해야 합니다.');
        }

        return anchor;
    }

    private async validateAnchorEventAvailability({
        trackId,
        anchorId,
        pauseId,
    }: {
        trackId: number;
        anchorId: number;
        pauseId?: number;
    }) {
        const [existingPause] = await this.pauseRepository.find({ trackId, anchorId });

        if (existingPause && existingPause.id !== pauseId) {
            throw new BadRequestException('앵커에 이미 일시정지 이벤트가 등록되어 있습니다.');
        }
        if (!this.scrollRepository) {
            return;
        }

        const [existingScroll] = await this.scrollRepository.find({ trackId, startAnchorId: anchorId });

        if (existingScroll) {
            throw new BadRequestException('앵커에 이미 스크롤 이벤트가 등록되어 있습니다.');
        }
    }
}
