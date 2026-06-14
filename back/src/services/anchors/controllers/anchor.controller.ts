import { Body, Controller, Delete, Dependencies, Get, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { AnchorService } from '../applications/anchor.service';
import { AnchorCreateDto, AnchorEventUpsertDto, AnchorUpdateDto } from './dto';

@Dependencies(AnchorService)
@Controller()
export class AnchorController {
    constructor(private readonly anchorService: AnchorService) {}

    /**
     * 앵커 등록
     */
    @Post('/tracks/:trackId/anchors')
    @HttpCode(201)
    async create(@Param('trackId', ParseIntPipe) trackId: number, @Body() body: AnchorCreateDto) {
        // 1. Destructure body, params, query
        const { canvasId, time, position, index } = body;

        // 2. Get context

        // 3. Get result
        await this.anchorService.create({ trackId, canvasId, time, position, index });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 앵커 목록 조회
     */
    @Get('/tracks/:trackId/anchors')
    async list(@Param('trackId', ParseIntPipe) trackId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.anchorService.list({ trackId });

        // 4. Send response
        return { data };
    }

    /**
     * 앵커 정보 수정
     */
    @Put('/tracks/:trackId/anchors/:anchorId')
    async update(
        @Param('trackId', ParseIntPipe) trackId: number,
        @Param('anchorId', ParseIntPipe) anchorId: number,
        @Body() body: AnchorUpdateDto
    ) {
        // 1. Destructure body, params, query
        const { canvasId, time, position, index } = body;

        // 2. Get context

        // 3. Get result
        await this.anchorService.update({ trackId, anchorId, canvasId, time, position, index });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 앵커 삭제
     */
    @Delete('/tracks/:trackId/anchors/:anchorId')
    async delete(@Param('trackId', ParseIntPipe) trackId: number, @Param('anchorId', ParseIntPipe) anchorId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        await this.anchorService.delete({ trackId, anchorId });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 앵커 이벤트 등록/수정
     */
    @Put('/tracks/:trackId/anchors/:anchorId/event')
    async upsertEvent(
        @Param('trackId', ParseIntPipe) trackId: number,
        @Param('anchorId', ParseIntPipe) anchorId: number,
        @Body() body: AnchorEventUpsertDto
    ) {
        // 1. Destructure body, params, query
        const { type, endAnchorId, duration } = body;

        // 2. Get context

        // 3. Get result
        await this.anchorService.upsertEvent({ trackId, anchorId, type, endAnchorId, duration });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 앵커 이벤트 삭제
     */
    @Delete('/tracks/:trackId/anchors/:anchorId/event')
    async deleteEvent(@Param('trackId', ParseIntPipe) trackId: number, @Param('anchorId', ParseIntPipe) anchorId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        await this.anchorService.deleteEvent({ trackId, anchorId });

        // 4. Send response
        return { data: {} };
    }
}
