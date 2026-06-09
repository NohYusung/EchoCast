import { Body, Controller, Dependencies, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { EpisodeService } from '../applications/episode.service';
import { EpisodeCreateDto } from './dto';

@Dependencies(EpisodeService)
@Controller()
export class EpisodeController {
    constructor(private readonly episodeService: EpisodeService) {}

    /**
     * 에피소드 등록
     */
    @Post('/products/:productId/episodes')
    async create(@Param('productId', ParseIntPipe) productId: number, @Body() body: EpisodeCreateDto) {
        // 1. Destructure body, params, query
        const { episodeNumber, title, subTitle } = body;

        // 2. Get context

        // 3. Get result
        await this.episodeService.create({ productId, episodeNumber, title, subTitle });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 에피소드 목록 조회
     */
    @Get('/products/:productId/episodes')
    async list(@Param('productId', ParseIntPipe) productId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.episodeService.list({ productId });

        // 4. Send response
        return { data };
    }
}
