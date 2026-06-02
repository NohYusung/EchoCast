import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GeneralPlayerService } from '../applications/general-player.service';
import { PlayerManifestQueryDto } from './dto';

@ApiTags('[테스트] 플레이어 API')
@Controller('player')
export class GeneralPlayerController {
    constructor(private readonly playerService: GeneralPlayerService) {}

    /**
     * 플레이어 manifest 조회
     */
    @Get('manifest/:manifestId')
    getManifest(
        @Param('manifestId') manifestId: string,
        @Query() query: PlayerManifestQueryDto
    ) {
        const data = this.playerService.getManifest({
            manifestId,
            variant: query.variant,
        });
        return { data };
    }
}

