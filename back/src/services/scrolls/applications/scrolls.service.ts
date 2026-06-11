import { Injectable } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Scroll } from '../domain/scroll.entity';
import { ScrollRepository } from '../repository/scroll.repository';

@Injectable()
export class ScrollsService extends DddService {
    constructor(private readonly scrollRepository: ScrollRepository) {
        super();
    }

    async create({
        trackId,
        startTime,
        endTime,
        startPosition,
        endPosition,
    }: {
        trackId: number;
        startTime: number;
        endTime: number;
        startPosition: number;
        endPosition: number;
    }) {
        const scroll = new Scroll({
            trackId,
            startTime,
            endTime,
            startPosition,
            endPosition,
        });

        await this.scrollRepository.save([scroll]);
        return {
            id: scroll.id,
            trackId: scroll.trackId,
            startTime: scroll.startTime,
            endTime: scroll.endTime,
            startPosition: scroll.startPosition,
            endPosition: scroll.endPosition,
        };
    }
}
