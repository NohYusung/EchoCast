import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { AnchorRepository } from '../../anchors/repository/anchor.repository';
import { Scroll } from '../domain/scroll.entity';
import { ScrollRepository } from '../repository/scroll.repository';

function toScrollResponse(scroll: Scroll) {
    return {
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
    };
}

@Injectable()
export class ScrollsService extends DddService {
    constructor(
        private readonly scrollRepository: ScrollRepository,
        private readonly anchorRepository: AnchorRepository
    ) {
        super();
    }

    async create({
        trackId,
        startAnchorId,
        endAnchorId,
    }: {
        trackId: number;
        startAnchorId: number;
        endAnchorId: number;
    }) {
        const [startAnchor, endAnchor] = await this.getScrollAnchors({ trackId, startAnchorId, endAnchorId });
        await this.validateAnchorEventAvailability({ trackId, startAnchorId });

        const scroll = new Scroll({
            trackId,
            startAnchorId,
            endAnchorId,
        });
        scroll.startAnchor = startAnchor;
        scroll.endAnchor = endAnchor;

        await this.scrollRepository.save([scroll]);

        return toScrollResponse(scroll);
    }

    async list({ trackId }: { trackId: number }) {
        const [scrolls, total] = await Promise.all([
            this.scrollRepository.find({ trackId }, { relations: { startAnchor: true, endAnchor: true } }),
            this.scrollRepository.count({ trackId }),
        ]);
        const items = scrolls
            .sort((a, b) => (a.startAnchor?.time ?? 0) - (b.startAnchor?.time ?? 0) || a.id - b.id)
            .map((scroll) => toScrollResponse(scroll));

        return { items, total };
    }

    async update({
        trackId,
        scrollId,
        startAnchorId,
        endAnchorId,
    }: {
        trackId: number;
        scrollId: number;
        startAnchorId?: number;
        endAnchorId?: number;
    }) {
        const [scroll] = await this.scrollRepository.find(
            { id: scrollId, trackId },
            { relations: { startAnchor: true, endAnchor: true } }
        );

        if (!scroll) {
            throw new NotFoundException('스크롤을 찾을 수 없습니다.');
        }

        const nextStartAnchorId = startAnchorId ?? scroll.startAnchorId;
        const nextEndAnchorId = endAnchorId ?? scroll.endAnchorId;
        const [startAnchor, endAnchor] = await this.getScrollAnchors({
            trackId,
            startAnchorId: nextStartAnchorId,
            endAnchorId: nextEndAnchorId,
        });
        await this.validateAnchorEventAvailability({ trackId, startAnchorId: nextStartAnchorId, scrollId });

        scroll.update({ startAnchorId, endAnchorId });
        scroll.startAnchor = startAnchor;
        scroll.endAnchor = endAnchor;
        await this.scrollRepository.save([scroll]);
    }

    async delete({ trackId, scrollId }: { trackId: number; scrollId: number }) {
        const [scroll] = await this.scrollRepository.find({ id: scrollId, trackId });

        if (!scroll) {
            throw new NotFoundException('스크롤을 찾을 수 없습니다.');
        }

        await this.scrollRepository.softRemove([scroll]);
    }

    private async getScrollAnchors({
        trackId,
        startAnchorId,
        endAnchorId,
    }: {
        trackId: number;
        startAnchorId: number;
        endAnchorId: number;
    }) {
        if (!Number.isInteger(startAnchorId) || !Number.isInteger(endAnchorId)) {
            throw new BadRequestException('스크롤 startAnchorId와 endAnchorId가 필요합니다.');
        }
        if (startAnchorId === endAnchorId) {
            throw new BadRequestException('스크롤 startAnchorId와 endAnchorId는 서로 달라야 합니다.');
        }

        const [[startAnchor], [endAnchor]] = await Promise.all([
            this.anchorRepository.find({ id: startAnchorId }),
            this.anchorRepository.find({ id: endAnchorId }),
        ]);

        if (!startAnchor || !endAnchor) {
            throw new NotFoundException('스크롤 앵커를 찾을 수 없습니다.');
        }
        if (startAnchor.trackId !== trackId || endAnchor.trackId !== trackId) {
            throw new BadRequestException('스크롤 앵커는 대상 트랙에 속해야 합니다.');
        }
        if (startAnchor.canvasId !== endAnchor.canvasId) {
            throw new BadRequestException('스크롤 앵커는 같은 캔버스에 속해야 합니다.');
        }
        if (!Number.isFinite(startAnchor.time) || !Number.isFinite(endAnchor.time) || endAnchor.time <= startAnchor.time) {
            throw new BadRequestException('스크롤 종료 앵커 시간은 시작 앵커 시간보다 커야 합니다.');
        }

        return [startAnchor, endAnchor] as const;
    }

    private async validateAnchorEventAvailability({
        trackId,
        startAnchorId,
        scrollId,
    }: {
        trackId: number;
        startAnchorId: number;
        scrollId?: number;
    }) {
        const [existingScroll] = await this.scrollRepository.find({ trackId, startAnchorId });

        if (existingScroll && existingScroll.id !== scrollId) {
            throw new BadRequestException('앵커에 이미 스크롤 이벤트가 등록되어 있습니다.');
        }
    }
}
