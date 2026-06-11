import { Controller, Dependencies, Get, Param, ParseIntPipe } from '@nestjs/common';
import { PlayerService } from '../applications/player.service';

@Dependencies(PlayerService)
@Controller()
export class PlayerController {
    constructor(private readonly playerService: PlayerService) {}

    /**
     * 제작 데이터 기반 유저 플레이어 manifest 조회
     */
    @Get('/player/manifest/:episodeId')
    async getManifest(@Param('episodeId', ParseIntPipe) episodeId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.playerService.getManifest({ episodeId });

        // 4. Send response
        return { data };
    }
}
