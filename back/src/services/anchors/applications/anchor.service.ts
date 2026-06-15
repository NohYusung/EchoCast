import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { ScrollRepository } from '../../scrolls/repository/scroll.repository';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { Anchor } from '../domain/anchor.entity';
import { AnchorRepository } from '../repository/anchor.repository';

function toScrollEventResponse(scroll: Scroll) {
    return {
        type: 'scroll' as const,
        id: scroll.id,
        scrollId: scroll.id,
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

type AnchorEventResponse = ReturnType<typeof toScrollEventResponse>;

function toAnchorResponse(anchor: Anchor, event: AnchorEventResponse | null = null) {
    return {
        id: anchor.id,
        trackId: anchor.trackId,
        canvasId: anchor.canvasId,
        time: anchor.time,
        position: anchor.position,
        index: anchor.index,
        event,
    };
}

@Injectable()
export class AnchorService extends DddService {
    constructor(
        private readonly anchorRepository: AnchorRepository,
        private readonly trackRepository: TrackRepository,
        private readonly canvasRepository: CanvasRepository,
        private readonly scrollRepository: ScrollRepository
    ) {
        super();
    }

    async create({
        trackId,
        canvasId,
        time,
        position,
        index,
    }: {
        trackId: number;
        canvasId: number;
        time: number;
        position: number;
        index: number;
    }) {
        const [[track], [canvas]] = await Promise.all([
            this.trackRepository.find({ id: trackId }),
            this.canvasRepository.find({ id: canvasId }),
        ]);

        if (!track) {
            throw new NotFoundException('트랙을 찾을 수 없습니다.');
        }
        if (!canvas) {
            throw new NotFoundException('캔버스를 찾을 수 없습니다.');
        }
        if (canvas.episodeId !== track.episodeId) {
            throw new BadRequestException('앵커 캔버스는 트랙의 에피소드에 속해야 합니다.');
        }
        if (!Number.isFinite(time)) {
            throw new BadRequestException('앵커 시간이 필요합니다.');
        }
        if (!Number.isInteger(index)) {
            throw new BadRequestException('앵커 인덱스는 정수여야 합니다.');
        }
        if (!Number.isFinite(position) || position < 0 || position > 100) {
            throw new BadRequestException('앵커 위치는 0 이상 100 이하여야 합니다.');
        }

        const anchor = new Anchor({
            trackId,
            canvasId,
            time,
            position,
            index,
        });
        await this.anchorRepository.save([anchor]);

        return toAnchorResponse(anchor);
    }

    async list({ trackId }: { trackId: number }) {
        const [anchors, total, scrolls] = await Promise.all([
            this.anchorRepository.find({ trackId }, { options: { sort: 'id', order: 'ASC' } }),
            this.anchorRepository.count({ trackId }),
            this.scrollRepository.find({ trackId }, { relations: { startAnchor: true, endAnchor: true } }),
        ]);
        const scrollByStartAnchorId = new Map(scrolls.map((scroll) => [scroll.startAnchorId, scroll]));
        const items = anchors.map((anchor) => {
            const scroll = scrollByStartAnchorId.get(anchor.id);

            return toAnchorResponse(anchor, scroll ? toScrollEventResponse(scroll) : null);
        });

        return { items, total };
    }

    async update({
        trackId,
        anchorId,
        canvasId,
        time,
        position,
        index,
    }: {
        trackId: number;
        anchorId: number;
        canvasId?: number;
        time?: number;
        position?: number;
        index?: number;
    }) {
        const [[track], [anchor]] = await Promise.all([
            this.trackRepository.find({ id: trackId }),
            this.anchorRepository.find({ id: anchorId, trackId }),
        ]);

        if (!track) {
            throw new NotFoundException('트랙을 찾을 수 없습니다.');
        }
        if (!anchor) {
            throw new NotFoundException('앵커를 찾을 수 없습니다.');
        }

        const nextCanvasId = canvasId ?? anchor.canvasId;
        const [canvas] = await this.canvasRepository.find({ id: nextCanvasId });

        if (!canvas) {
            throw new NotFoundException('캔버스를 찾을 수 없습니다.');
        }
        if (canvas.episodeId !== track.episodeId) {
            throw new BadRequestException('앵커 캔버스는 트랙의 에피소드에 속해야 합니다.');
        }

        const nextTime = time ?? anchor.time;
        const nextPosition = position ?? anchor.position;
        const nextIndex = index ?? anchor.index;

        if (!Number.isFinite(nextTime)) {
            throw new BadRequestException('앵커 시간이 필요합니다.');
        }
        if (!Number.isInteger(nextIndex)) {
            throw new BadRequestException('앵커 인덱스는 정수여야 합니다.');
        }
        if (!Number.isFinite(nextPosition) || nextPosition < 0 || nextPosition > 100) {
            throw new BadRequestException('앵커 위치는 0 이상 100 이하여야 합니다.');
        }

        anchor.update({ canvasId, time, position, index });
        await this.anchorRepository.save([anchor]);
    }

    async delete({ trackId, anchorId }: { trackId: number; anchorId: number }) {
        const [[anchor], scrollsStartingAtAnchor, scrollsEndingAtAnchor] = await Promise.all([
            this.anchorRepository.find({ id: anchorId, trackId }),
            this.scrollRepository.find({ trackId, startAnchorId: anchorId }),
            this.scrollRepository.find({ trackId, endAnchorId: anchorId }),
        ]);

        if (!anchor) {
            throw new NotFoundException('앵커를 찾을 수 없습니다.');
        }

        const scrollsById = new Map(
            [...scrollsStartingAtAnchor, ...scrollsEndingAtAnchor].map((scroll) => [scroll.id, scroll])
        );
        const scrolls = [...scrollsById.values()];

        if (scrolls.length > 0) {
            await this.scrollRepository.softRemove(scrolls);
        }
        await this.anchorRepository.softRemove([anchor]);
    }

    async upsertEvent({
        trackId,
        anchorId,
        type,
        endAnchorId,
    }: {
        trackId: number;
        anchorId: number;
        type: string;
        endAnchorId?: number;
    }) {
        const [[anchor], ownedScroll] = await Promise.all([
            this.anchorRepository.find({ id: anchorId, trackId }),
            this.findOwnedScroll({ trackId, anchorId, withDeleted: true }),
        ]);

        if (!anchor) {
            throw new NotFoundException('앵커를 찾을 수 없습니다.');
        }
        if (type !== 'scroll') {
            throw new BadRequestException('앵커 이벤트 타입이 올바르지 않습니다.');
        }
        if (!Number.isInteger(endAnchorId)) {
            throw new BadRequestException('앵커 스크롤 이벤트의 endAnchorId가 필요합니다.');
        }
        const nextEndAnchorId = Number(endAnchorId);

        const [endAnchor] = await this.anchorRepository.find({ id: nextEndAnchorId });

        if (!endAnchor) {
            throw new NotFoundException('앵커 스크롤 이벤트의 종료 앵커를 찾을 수 없습니다.');
        }
        if (endAnchor.trackId !== trackId) {
            throw new BadRequestException('앵커 스크롤 이벤트의 종료 앵커는 대상 트랙에 속해야 합니다.');
        }
        if (anchor.id === endAnchor.id) {
            throw new BadRequestException('앵커 스크롤 이벤트의 종료 앵커는 시작 앵커와 달라야 합니다.');
        }
        if (anchor.canvasId !== endAnchor.canvasId) {
            throw new BadRequestException('앵커 스크롤 이벤트의 앵커들은 같은 캔버스에 속해야 합니다.');
        }
        if (!Number.isFinite(anchor.time) || !Number.isFinite(endAnchor.time) || endAnchor.time <= anchor.time) {
            throw new BadRequestException('앵커 스크롤 이벤트의 종료 앵커 시간은 시작 앵커 시간보다 커야 합니다.');
        }

        const scroll = ownedScroll ?? new Scroll({ trackId, startAnchorId: anchor.id, endAnchorId: nextEndAnchorId });

        scroll.deletedAt = null;
        scroll.update({ endAnchorId: nextEndAnchorId });
        scroll.startAnchor = anchor;
        scroll.endAnchor = endAnchor;
        await this.scrollRepository.save([scroll]);

        return toAnchorResponse(anchor, toScrollEventResponse(scroll));
    }

    async deleteEvent({ trackId, anchorId }: { trackId: number; anchorId: number }) {
        const [[anchor], ownedScrolls] = await Promise.all([
            this.anchorRepository.find({ id: anchorId, trackId }),
            this.scrollRepository.find({ trackId, startAnchorId: anchorId }),
        ]);

        if (!anchor) {
            throw new NotFoundException('앵커를 찾을 수 없습니다.');
        }
        if (ownedScrolls.length > 0) {
            await this.scrollRepository.softRemove(ownedScrolls);
        }
    }

    private async findOwnedScroll({
        trackId,
        anchorId,
        withDeleted,
    }: {
        trackId: number;
        anchorId: number;
        withDeleted?: boolean;
    }) {
        const query = this.scrollRepository
            .createQueryBuilder('scroll')
            .leftJoinAndSelect('scroll.startAnchor', 'startAnchor')
            .leftJoinAndSelect('scroll.endAnchor', 'endAnchor')
            .where('scroll.trackId = :trackId', { trackId })
            .andWhere('scroll.startAnchorId = :anchorId', { anchorId });

        if (withDeleted) {
            query.withDeleted();
        }

        return query.getOne();
    }
}
