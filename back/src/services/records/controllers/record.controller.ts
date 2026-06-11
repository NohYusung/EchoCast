import { Body, Controller, Dependencies, Post } from '@nestjs/common';
import { RecordService } from '../applications/record.service';
import { RecordCreateDto } from './dto';

@Dependencies(RecordService)
@Controller()
export class RecordController {
    constructor(private readonly recordService: RecordService) {}

    /**
     * 레코드 등록
     */
    @Post('/records')
    async create(@Body() body: RecordCreateDto) {
        // 1. Destructure body, params, query
        const { cueId, artistId, status, audioUrl, durationMs, volume } = body;

        // 2. Get context

        // 3. Get result
        await this.recordService.create({ cueId, artistId, status, audioUrl, durationMs, volume });

        // 4. Send response
        return { data: {} };
    }
}
