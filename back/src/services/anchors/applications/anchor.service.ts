import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { Anchor } from '../domain/anchor.entity';
import { AnchorRepository } from '../repository/anchor.repository';

@Injectable()
export class AnchorService extends DddService {
    constructor(
        private readonly anchorRepository: AnchorRepository,
        private readonly trackRepository: TrackRepository,
        private readonly canvasRepository: CanvasRepository
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

        return {
            id: anchor.id,
            trackId: anchor.trackId,
            canvasId: anchor.canvasId,
            time: anchor.time,
            position: anchor.position,
            index: anchor.index,
        };
    }

    async list({ trackId }: { trackId: number }) {
        const [anchors, total] = await Promise.all([
            this.anchorRepository.find({ trackId }, { options: { sort: 'id', order: 'ASC' } }),
            this.anchorRepository.count({ trackId }),
        ]);
        const items = anchors.map((anchor) => ({
            id: anchor.id,
            trackId: anchor.trackId,
            canvasId: anchor.canvasId,
            time: anchor.time,
            position: anchor.position,
            index: anchor.index,
        }));

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
}
