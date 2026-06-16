import { Controller, Dependencies, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { PlayerService } from '../applications/player.service';
import { PlayerManifestQueryDto } from './dto';

@Dependencies(PlayerService)
@Controller()
export class PlayerController {
    constructor(private readonly playerService: PlayerService) {}

    @Get('/player/manifest/:episodeId')
    async getPlayerInfo(@Param('episodeId', ParseIntPipe) episodeId: number, @Query() query: PlayerManifestQueryDto) {
        // 1. Destructure body, params, query
        const { canvasId } = PlayerManifestQueryDto.toServiceQuery(query);

        // 2. Get context

        // 3. Get result
        const data = await this.playerService.getPlayerInfo({ episodeId, canvasId });

        // 4. Send response
        return { data };
    }
}
