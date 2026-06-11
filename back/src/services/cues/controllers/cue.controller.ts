import { Body, Controller, Delete, Dependencies, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { CueService } from '../applications/cue.service';
import { CueCreateDto, CueUpdateDto } from './dto';

@Dependencies(CueService)
@Controller()
export class CueController {
    constructor(private readonly cueService: CueService) {}

    /**
     * 큐 등록
     */
    @Post('/tracks/:trackId/cues')
    async create(@Param('trackId', ParseIntPipe) trackId: number, @Body() body: CueCreateDto) {
        // 1. Destructure body, params, query
        const { script, startTime, endTime, ttsVoiceId, volume } = body;

        // 2. Get context

        // 3. Get result
        await this.cueService.create({ trackId, script, startTime, endTime, ttsVoiceId, volume });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 큐 정보 수정
     */
    @Put('/tracks/:trackId/cues/:cueId')
    async update(
        @Param('trackId', ParseIntPipe) trackId: number,
        @Param('cueId', ParseIntPipe) cueId: number,
        @Body() body: CueUpdateDto
    ) {
        // 1. Destructure body, params, query
        const { script, startTime, endTime, ttsVoiceId, volume } = body;

        // 2. Get context

        // 3. Get result
        await this.cueService.update({ trackId, cueId, script, startTime, endTime, ttsVoiceId, volume });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 큐 삭제
     */
    @Delete('/tracks/:trackId/cues/:cueId')
    async delete(@Param('trackId', ParseIntPipe) trackId: number, @Param('cueId', ParseIntPipe) cueId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        await this.cueService.delete({ trackId, cueId });

        // 4. Send response
        return { data: {} };
    }
}
