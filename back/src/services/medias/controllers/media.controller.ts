import { Body, Controller, Delete, Dependencies, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { MediaService } from '../applications/media.service';
import { MediaCreateDto } from './dto';

@Dependencies(MediaService)
@Controller()
export class MediaController {
    constructor(private readonly mediaService: MediaService) {}

    /**
     * 미디어 등록
     */
    @Post('/episodes/:episodeId/medias')
    async create(@Param('episodeId', ParseIntPipe) episodeId: number, @Body() body: MediaCreateDto) {
        // 1. Destructure body, params, query
        const { mediaName, mediaType, mediaUrl, duration } = body;

        // 2. Get context

        // 3. Get result
        await this.mediaService.create({ episodeId, mediaName, mediaType, mediaUrl, duration });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 미디어 목록 조회
     */
    @Get('/episodes/:episodeId/medias')
    async list(@Param('episodeId', ParseIntPipe) episodeId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.mediaService.list({ episodeId });

        // 4. Send response
        return { data };
    }

    /**
     * 미디어 삭제
     */
    @Delete('/episodes/:episodeId/medias/:mediaId')
    async delete(
        @Param('episodeId', ParseIntPipe) episodeId: number,
        @Param('mediaId', ParseIntPipe) mediaId: number
    ) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        await this.mediaService.delete({ episodeId, mediaId });

        // 4. Send response
        return { data: {} };
    }
}
