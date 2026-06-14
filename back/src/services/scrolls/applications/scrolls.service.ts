import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { AnchorRepository } from '../../anchors/repository/anchor.repository';
import { PauseRepository } from '../../pauses/repository/pause.repository';
import { Scroll } from '../domain/scroll.entity';
import { ScrollRepository } from '../repository/scroll.repository';

function toScrollResponse(scroll: Scroll) {
    return {
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
    };
}

@Injectable()
export class ScrollsService extends DddService {
    constructor(
        private readonly scrollRepository: ScrollRepository,
        private readonly anchorRepository: AnchorRepository,
        private readonly pauseRepository?: PauseRepository
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
            .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0) || a.id - b.id)
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
            throw new NotFoundException('Scroll not found.');
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
            throw new NotFoundException('Scroll not found.');
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
            throw new BadRequestException('Scroll startAnchorId and endAnchorId are required.');
        }
        if (startAnchorId === endAnchorId) {
            throw new BadRequestException('Scroll startAnchorId and endAnchorId must be different.');
        }

        const [[startAnchor], [endAnchor]] = await Promise.all([
            this.anchorRepository.find({ id: startAnchorId }),
            this.anchorRepository.find({ id: endAnchorId }),
        ]);

        if (!startAnchor || !endAnchor) {
            throw new NotFoundException('Scroll anchor not found.');
        }
        if (startAnchor.trackId !== trackId || endAnchor.trackId !== trackId) {
            throw new BadRequestException('Scroll anchors must belong to the target track.');
        }
        if (startAnchor.canvasId !== endAnchor.canvasId) {
            throw new BadRequestException('Scroll anchors must belong to the same canvas.');
        }
        if (!Number.isFinite(startAnchor.time) || !Number.isFinite(endAnchor.time) || endAnchor.time <= startAnchor.time) {
            throw new BadRequestException('Scroll end anchor time must be greater than start anchor time.');
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
            throw new BadRequestException('Anchor already owns a scroll event.');
        }
        if (!this.pauseRepository) {
            return;
        }

        const [existingPause] = await this.pauseRepository.find({ trackId, anchorId: startAnchorId });

        if (existingPause) {
            throw new BadRequestException('Anchor already owns a pause event.');
        }
    }
}
