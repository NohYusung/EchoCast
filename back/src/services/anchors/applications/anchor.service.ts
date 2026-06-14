import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import { Pause } from '../../pauses/domain/pause.entity';
import { PauseRepository } from '../../pauses/repository/pause.repository';
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

function toPauseEventResponse(pause: Pause) {
    return {
        type: 'pause' as const,
        id: pause.id,
        pauseId: pause.id,
        anchorId: pause.anchorId,
        duration: pause.duration,
        canvasId: pause.canvasId,
        index: pause.index,
        time: pause.time,
        position: pause.position,
    };
}

type AnchorEventResponse = ReturnType<typeof toScrollEventResponse> | ReturnType<typeof toPauseEventResponse>;

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
        private readonly scrollRepository: ScrollRepository,
        private readonly pauseRepository: PauseRepository
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
            throw new NotFoundException('Track not found.');
        }
        if (!canvas) {
            throw new NotFoundException('Canvas not found.');
        }
        if (canvas.episodeId !== track.episodeId) {
            throw new BadRequestException('Anchor canvas must belong to the track episode.');
        }
        if (!Number.isFinite(time)) {
            throw new BadRequestException('Anchor time is required.');
        }
        if (!Number.isInteger(index)) {
            throw new BadRequestException('Anchor index must be an integer.');
        }
        if (!Number.isFinite(position) || position < 0 || position > 100) {
            throw new BadRequestException('Anchor position must be between 0 and 100.');
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
        const [anchors, total, scrolls, pauses] = await Promise.all([
            this.anchorRepository.find({ trackId }, { options: { sort: 'id', order: 'ASC' } }),
            this.anchorRepository.count({ trackId }),
            this.scrollRepository.find({ trackId }, { relations: { startAnchor: true, endAnchor: true } }),
            this.pauseRepository.find({ trackId }, { relations: { anchor: true } }),
        ]);
        const scrollByStartAnchorId = new Map(scrolls.map((scroll) => [scroll.startAnchorId, scroll]));
        const pauseByAnchorId = new Map(pauses.map((pause) => [pause.anchorId, pause]));
        const items = anchors.map((anchor) => {
            const scroll = scrollByStartAnchorId.get(anchor.id);
            const pause = pauseByAnchorId.get(anchor.id);

            return toAnchorResponse(
                anchor,
                scroll ? toScrollEventResponse(scroll) : pause ? toPauseEventResponse(pause) : null
            );
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
            throw new NotFoundException('Track not found.');
        }
        if (!anchor) {
            throw new NotFoundException('Anchor not found.');
        }

        const nextCanvasId = canvasId ?? anchor.canvasId;
        const [canvas] = await this.canvasRepository.find({ id: nextCanvasId });

        if (!canvas) {
            throw new NotFoundException('Canvas not found.');
        }
        if (canvas.episodeId !== track.episodeId) {
            throw new BadRequestException('Anchor canvas must belong to the track episode.');
        }

        const nextTime = time ?? anchor.time;
        const nextPosition = position ?? anchor.position;
        const nextIndex = index ?? anchor.index;

        if (!Number.isFinite(nextTime)) {
            throw new BadRequestException('Anchor time is required.');
        }
        if (!Number.isInteger(nextIndex)) {
            throw new BadRequestException('Anchor index must be an integer.');
        }
        if (!Number.isFinite(nextPosition) || nextPosition < 0 || nextPosition > 100) {
            throw new BadRequestException('Anchor position must be between 0 and 100.');
        }

        anchor.update({ canvasId, time, position, index });
        await this.anchorRepository.save([anchor]);
    }

    async delete({ trackId, anchorId }: { trackId: number; anchorId: number }) {
        const [[anchor], scrollsStartingAtAnchor, scrollsEndingAtAnchor, pauses] = await Promise.all([
            this.anchorRepository.find({ id: anchorId, trackId }),
            this.scrollRepository.find({ trackId, startAnchorId: anchorId }),
            this.scrollRepository.find({ trackId, endAnchorId: anchorId }),
            this.pauseRepository.find({ trackId, anchorId }),
        ]);

        if (!anchor) {
            throw new NotFoundException('Anchor not found.');
        }

        const scrollsById = new Map(
            [...scrollsStartingAtAnchor, ...scrollsEndingAtAnchor].map((scroll) => [scroll.id, scroll])
        );
        const scrolls = [...scrollsById.values()];

        if (scrolls.length > 0) {
            await this.scrollRepository.softRemove(scrolls);
        }
        if (pauses.length > 0) {
            await this.pauseRepository.softRemove(pauses);
        }
        await this.anchorRepository.softRemove([anchor]);
    }

    async upsertEvent({
        trackId,
        anchorId,
        type,
        endAnchorId,
        duration,
    }: {
        trackId: number;
        anchorId: number;
        type: 'scroll' | 'pause';
        endAnchorId?: number;
        duration?: number;
    }) {
        const [[anchor], ownedScroll, ownedPause] = await Promise.all([
            this.anchorRepository.find({ id: anchorId, trackId }),
            this.findOwnedScroll({ trackId, anchorId, withDeleted: true }),
            this.findOwnedPause({ trackId, anchorId, withDeleted: true }),
        ]);

        if (!anchor) {
            throw new NotFoundException('Anchor not found.');
        }
        if (type === 'scroll') {
            if (!Number.isInteger(endAnchorId)) {
                throw new BadRequestException('Anchor scroll event endAnchorId is required.');
            }
            const nextEndAnchorId = Number(endAnchorId);

            const [endAnchor] = await this.anchorRepository.find({ id: nextEndAnchorId });

            if (!endAnchor) {
                throw new NotFoundException('Anchor scroll event end anchor not found.');
            }
            if (endAnchor.trackId !== trackId) {
                throw new BadRequestException('Anchor scroll event end anchor must belong to the target track.');
            }
            if (anchor.id === endAnchor.id) {
                throw new BadRequestException('Anchor scroll event end anchor must be different.');
            }
            if (anchor.canvasId !== endAnchor.canvasId) {
                throw new BadRequestException('Anchor scroll event anchors must belong to the same canvas.');
            }
            if (!Number.isFinite(anchor.time) || !Number.isFinite(endAnchor.time) || endAnchor.time <= anchor.time) {
                throw new BadRequestException(
                    'Anchor scroll event end anchor time must be greater than owner anchor time.'
                );
            }
            if (ownedPause && !ownedPause.deletedAt) {
                await this.pauseRepository.softRemove([ownedPause]);
            }

            const scroll =
                ownedScroll ?? new Scroll({ trackId, startAnchorId: anchor.id, endAnchorId: nextEndAnchorId });

            scroll.deletedAt = null;
            scroll.update({ endAnchorId: nextEndAnchorId });
            scroll.startAnchor = anchor;
            scroll.endAnchor = endAnchor;
            await this.scrollRepository.save([scroll]);

            return toAnchorResponse(anchor, toScrollEventResponse(scroll));
        }
        if (type === 'pause') {
            const nextDuration = Number(duration);
            if (!Number.isFinite(nextDuration) || nextDuration <= 0) {
                throw new BadRequestException('Anchor pause event duration must be greater than 0.');
            }
            if (ownedScroll && !ownedScroll.deletedAt) {
                await this.scrollRepository.softRemove([ownedScroll]);
            }

            const pause = ownedPause ?? new Pause({ trackId, anchorId: anchor.id, duration: nextDuration });

            pause.deletedAt = null;
            pause.update({ duration: nextDuration });
            pause.anchor = anchor;
            await this.pauseRepository.save([pause]);

            return toAnchorResponse(anchor, toPauseEventResponse(pause));
        }

        throw new BadRequestException('Anchor event type is invalid.');
    }

    async deleteEvent({ trackId, anchorId }: { trackId: number; anchorId: number }) {
        const [[anchor], ownedScrolls, ownedPauses] = await Promise.all([
            this.anchorRepository.find({ id: anchorId, trackId }),
            this.scrollRepository.find({ trackId, startAnchorId: anchorId }),
            this.pauseRepository.find({ trackId, anchorId }),
        ]);

        if (!anchor) {
            throw new NotFoundException('Anchor not found.');
        }
        if (ownedScrolls.length > 0) {
            await this.scrollRepository.softRemove(ownedScrolls);
        }
        if (ownedPauses.length > 0) {
            await this.pauseRepository.softRemove(ownedPauses);
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

    private async findOwnedPause({
        trackId,
        anchorId,
        withDeleted,
    }: {
        trackId: number;
        anchorId: number;
        withDeleted?: boolean;
    }) {
        const query = this.pauseRepository
            .createQueryBuilder('pause')
            .leftJoinAndSelect('pause.anchor', 'anchor')
            .where('pause.trackId = :trackId', { trackId })
            .andWhere('pause.anchorId = :anchorId', { anchorId });

        if (withDeleted) {
            query.withDeleted();
        }

        return query.getOne();
    }
}
