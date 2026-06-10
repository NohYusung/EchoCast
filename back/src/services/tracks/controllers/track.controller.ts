import { Body, Controller, Delete, Dependencies, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { TrackService } from '../applications/track.service';
import { TrackCreateDto } from './dto';

@Dependencies(TrackService)
@Controller()
export class TrackController {
    constructor(private readonly trackService: TrackService) {}

    /**
     * 트랙 등록
     */
    @Post('/episodes/:episodeId/tracks')
    async create(@Param('episodeId', ParseIntPipe) episodeId: number, @Body() body: TrackCreateDto) {
        // 1. Destructure body, params, query
        const { name, type, isMuted } = body;

        // 2. Get context

        // 3. Get result
        await this.trackService.create({ episodeId, name, type, isMuted });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 트랙 목록 조회
     */
    @Get('/episodes/:episodeId/tracks')
    async list(@Param('episodeId', ParseIntPipe) episodeId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.trackService.list({ episodeId });

        // 4. Send response
        return { data };
    }

    /**
     * 트랙 삭제
     */
    @Delete('/episodes/:episodeId/tracks/:trackId')
    async delete(
        @Param('episodeId', ParseIntPipe) episodeId: number,
        @Param('trackId', ParseIntPipe) trackId: number
    ) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        await this.trackService.delete({ episodeId, trackId });

        // 4. Send response
        return { data: {} };
    }
}
