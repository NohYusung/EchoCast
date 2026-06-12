import { Body, Controller, Dependencies, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CanvasService } from '../applications/canvas.service';
import { CanvasCreateDto } from './dto';

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
}
