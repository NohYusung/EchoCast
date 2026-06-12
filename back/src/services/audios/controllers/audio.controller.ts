import { Body, Controller, Dependencies, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { AudioService } from '../applications/audio.service';
import { AudioCreateDto, AudioDropDto } from './dto';

@Dependencies(AudioService)
@Controller()
export class AudioController {
    constructor(private readonly audioService: AudioService) {}

    /**
     * 오디오 등록
     */
    @Post('/episodes/:episodeId/audios')
    async create(@Param('episodeId', ParseIntPipe) episodeId: number, @Body() body: AudioCreateDto) {
        // 1. Destructure body, params, query
        const { audioType, name, audioUrl, duration } = body;

        // 2. Get context

        // 3. Get result
        await this.audioService.create({ episodeId, audioType, name, audioUrl, duration });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 오디오를 타임라인 트랙에 배치
     */
    @Post('/episodes/:episodeId/audios/:audioId/drop-to-track')
    async dropToTrack(
        @Param('episodeId', ParseIntPipe) episodeId: number,
        @Param('audioId', ParseIntPipe) audioId: number,
        @Body() body: AudioDropDto
    ) {
        // 1. Destructure body, params, query
        const { trackId, trackName, trackType, characterId, startTime, endTime, volume } = body;

        // 2. Get context

        // 3. Get result
        const data = await this.audioService.dropToTrack({
            episodeId,
            audioId,
            trackId,
            trackName,
            trackType,
            characterId,
            startTime,
            endTime,
            volume,
        });

        // 4. Send response
        return { data };
    }

    /**
     * 오디오 목록 조회
     */
    @Get('/episodes/:episodeId/audios')
    async list(@Param('episodeId', ParseIntPipe) episodeId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.audioService.list({ episodeId });

        // 4. Send response
        return { data };
    }
}
