import { Controller, Dependencies, Get, Param, ParseIntPipe } from '@nestjs/common';
import { PlayerService } from '../applications/player.service';

@Dependencies(PlayerService)
@Controller()
export class PlayerController {
    constructor(private readonly playerService: PlayerService) {}

    /**
     * 제작 데이터 기반 유저 플레이어 manifest 조회
     *
     * 예상 응답:
     * {
     *   data: {
     *     episodeId: '1',
     *     durationMs: 3000,
     *     tracks: [
     *       { id: 'visual-1', name: 'Visual', kind: 'visual', layerId: 0, isMuted: false },
     *       { id: '1', name: 'Dialogue', kind: 'dialogue', layerId: 1, isMuted: false }
     *     ],
     *     items: [
     *       { id: 'visual-1', trackId: 'visual-1', kind: 'visual', startTime: 0, endTime: 3000, mediaId: '1', layerId: 0, volume: 1 },
     *       { id: 'cue-1', trackId: '1', kind: 'cue', startTime: 500, endTime: 2500, cueId: '1', layerId: 1, volume: 1 }
     *     ],
     *     cues: [
     *       {
     *         id: '1',
     *         scriptId: 'cue-1',
     *         characterId: '1',
     *         trackId: '1',
     *         startTime: 500,
     *         endTime: 2500,
     *         approvedRecordUrl: 'https://assets.example.com/record.wav',
     *         volume: 1
     *       }
     *     ],
     *     media: [{ id: '1', kind: 'image', url: 'https://assets.example.com/visual.png' }],
     *     records: [
     *       {
     *         id: '1',
     *         cueId: '1',
     *         artistId: '1',
     *         audioUrl: 'https://assets.example.com/record.wav',
     *         duration: 1700,
     *         volume: 1
     *       }
     *     ],
     *     tts: []
     *   }
     * }
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
