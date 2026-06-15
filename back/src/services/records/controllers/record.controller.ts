import { Body, Controller, Delete, Dependencies, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { RecordService } from '../applications/record.service';
import { RecordCreateDto, RecordUpdateDto } from './dto';

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
        const { cueId, artistId, recordUrl, duration, volume, isAccepted } = body;

        // 2. Get context

        // 3. Get result
        await this.recordService.create({ cueId, artistId, recordUrl, duration, volume, isAccepted });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 녹음 목록 조회
     */
    @Get('/records')
    async list() {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.recordService.list();

        // 4. Send response
        return { data };
    }

    /**
     * 녹음 수정
     */
    @Put('/records/:recordId')
    async update(@Param('recordId', ParseIntPipe) recordId: number, @Body() body: RecordUpdateDto) {
        // 1. Destructure body, params, query
        const { cueId, artistId, recordUrl, duration, volume, isAccepted } = body;

        // 2. Get context

        // 3. Get result
        await this.recordService.update({ recordId, cueId, artistId, recordUrl, duration, volume, isAccepted });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 녹음 삭제
     */
    @Delete('/records/:recordId')
    async delete(@Param('recordId', ParseIntPipe) recordId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        await this.recordService.delete({ recordId });

        // 4. Send response
        return { data: {} };
    }
}
