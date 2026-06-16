import { Body, Controller, Dependencies, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { EpisodeService } from '../applications/episode.service';
import { EpisodeCreateDto, EpisodeUpdateDto } from './dto';

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
        const { episodeNumber, title, subTitle, thumbnailImageUrl, defaultCanvasId } = body;

        // 2. Get context

        // 3. Get result
        await this.episodeService.create({
            productId,
            episodeNumber,
            title,
            subTitle,
            thumbnailImageUrl,
            defaultCanvasId,
        });

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

    /**
     * 에피소드 상세 조회
     */
    @Get('/products/:productId/episodes/:episodeId')
    async retrieve(
        @Param('productId', ParseIntPipe) productId: number,
        @Param('episodeId', ParseIntPipe) episodeId: number
    ) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.episodeService.retrieve({ productId, episodeId });

        // 4. Send response
        return { data };
    }

    /**
     * 에피소드 정보 수정
     */
    @Put('/products/:productId/episodes/:episodeId')
    async update(
        @Param('productId', ParseIntPipe) productId: number,
        @Param('episodeId', ParseIntPipe) episodeId: number,
        @Body() body: EpisodeUpdateDto
    ) {
        // 1. Destructure body, params, query
        const { episodeNumber, title, subTitle, thumbnailImageUrl, defaultCanvasId } = body;

        // 2. Get context

        // 3. Get result
        await this.episodeService.update({
            productId,
            episodeId,
            episodeNumber,
            title,
            subTitle,
            thumbnailImageUrl,
            defaultCanvasId,
        });

        // 4. Send response
        return { data: {} };
    }
}
