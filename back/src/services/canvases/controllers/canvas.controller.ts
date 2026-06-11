import { Controller, Dependencies, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CanvasService } from '../applications/canvas.service';

@Dependencies(CanvasService)
@Controller()
export class CanvasController {
    constructor(private readonly canvasService: CanvasService) {}

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
