import { Body, Controller, Dependencies, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ScrollsService } from '../applications/scrolls.service';
import { ScrollCreateDto } from './dto';

@Dependencies(ScrollsService)
@Controller()
export class ScrollsController {
    constructor(private readonly scrollsService: ScrollsService) {}

    /**
     * 스크롤 이벤트 등록
     */
    @Post('/tracks/:trackId/scrolls')
    async create(@Param('trackId', ParseIntPipe) trackId: number, @Body() body: ScrollCreateDto) {
        // 1. Destructure body, params, query
        const { startTime, endTime, startPosition, endPosition } = body;

        // 2. Get context

        // 3. Get result
        await this.scrollsService.create({ trackId, startTime, endTime, startPosition, endPosition });

        // 4. Send response
        return { data: {} };
    }
}
