import { Body, Controller, Delete, Dependencies, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { PauseService } from '../applications/pause.service';
import { PauseCreateDto, PauseUpdateDto } from './dto';

@Dependencies(PauseService)
@Controller()
export class PauseController {
    constructor(private readonly pauseService: PauseService) {}

    /**
     * 정지 이벤트 등록
     */
    @Post('/tracks/:trackId/pauses')
    async create(@Param('trackId', ParseIntPipe) trackId: number, @Body() body: PauseCreateDto) {
        // 1. Destructure body, params, query
        const { anchorId, duration } = body;

        // 2. Get context

        // 3. Get result
        await this.pauseService.create({ trackId, anchorId, duration });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 정지 이벤트 목록 조회
     */
    @Get('/tracks/:trackId/pauses')
    async list(@Param('trackId', ParseIntPipe) trackId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.pauseService.list({ trackId });

        // 4. Send response
        return { data };
    }

    /**
     * 정지 이벤트 수정
     */
    @Put('/tracks/:trackId/pauses/:pauseId')
    async update(
        @Param('trackId', ParseIntPipe) trackId: number,
        @Param('pauseId', ParseIntPipe) pauseId: number,
        @Body() body: PauseUpdateDto
    ) {
        // 1. Destructure body, params, query
        const { anchorId, duration } = body;

        // 2. Get context

        // 3. Get result
        await this.pauseService.update({ trackId, pauseId, anchorId, duration });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 정지 이벤트 삭제
     */
    @Delete('/tracks/:trackId/pauses/:pauseId')
    async delete(@Param('trackId', ParseIntPipe) trackId: number, @Param('pauseId', ParseIntPipe) pauseId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        await this.pauseService.delete({ trackId, pauseId });

        // 4. Send response
        return { data: {} };
    }
}
