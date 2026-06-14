import { Body, Controller, Delete, Dependencies, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ScrollsService } from '../applications/scrolls.service';
import { ScrollCreateDto, ScrollUpdateDto } from './dto';

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
        const { startAnchorId, endAnchorId } = body;

        // 2. Get context

        // 3. Get result
        await this.scrollsService.create({ trackId, startAnchorId, endAnchorId });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 스크롤 이벤트 목록 조회
     */
    @Get('/tracks/:trackId/scrolls')
    async list(@Param('trackId', ParseIntPipe) trackId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.scrollsService.list({ trackId });

        // 4. Send response
        return { data };
    }

    /**
     * 스크롤 이벤트 수정
     */
    @Put('/tracks/:trackId/scrolls/:scrollId')
    async update(
        @Param('trackId', ParseIntPipe) trackId: number,
        @Param('scrollId', ParseIntPipe) scrollId: number,
        @Body() body: ScrollUpdateDto
    ) {
        // 1. Destructure body, params, query
        const { startAnchorId, endAnchorId } = body;

        // 2. Get context

        // 3. Get result
        await this.scrollsService.update({ trackId, scrollId, startAnchorId, endAnchorId });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 스크롤 이벤트 삭제
     */
    @Delete('/tracks/:trackId/scrolls/:scrollId')
    async delete(@Param('trackId', ParseIntPipe) trackId: number, @Param('scrollId', ParseIntPipe) scrollId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        await this.scrollsService.delete({ trackId, scrollId });

        // 4. Send response
        return { data: {} };
    }
}
