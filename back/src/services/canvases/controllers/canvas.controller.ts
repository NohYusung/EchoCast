import { Body, Controller, Dependencies, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { CanvasService } from '../applications/canvas.service';
import { CanvasCreateDto, CanvasUpdateDto } from './dto';

@Dependencies(CanvasService)
@Controller()
export class CanvasController {
    constructor(private readonly canvasService: CanvasService) {}

    /**
     * 캔버스 등록
     */
    @Post('/episodes/:episodeId/canvases')
    async create(@Param('episodeId', ParseIntPipe) episodeId: number, @Body() body: CanvasCreateDto) {
        // 1. Destructure body, params, query
        const { medias = [] } = body;

        // 2. Get context

        // 3. Get result
        await this.canvasService.create({ episodeId, medias });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 캔버스 목록 조회
     */
    @Get('/episodes/:episodeId/canvases')
    async list(@Param('episodeId', ParseIntPipe) episodeId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.canvasService.list({ episodeId });

        // 4. Send response
        return { data };
    }

    /**
     * 캔버스 정보 수정
     */
    @Put('/episodes/:episodeId/canvases/:canvasId')
    async update(
        @Param('episodeId', ParseIntPipe) episodeId: number,
        @Param('canvasId', ParseIntPipe) canvasId: number,
        @Body() body: CanvasUpdateDto
    ) {
        // 1. Destructure body, params, query
        const { medias = [] } = body;

        // 2. Get context

        // 3. Get result
        await this.canvasService.update({ episodeId, canvasId, medias });

        // 4. Send response
        return { data: {} };
    }
}
