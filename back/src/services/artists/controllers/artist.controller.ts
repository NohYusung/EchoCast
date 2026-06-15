import { Body, Controller, Dependencies, Get, Post } from '@nestjs/common';
import { ArtistService } from '../applications/artist.service';
import { ArtistCreateDto } from './dto';

@Dependencies(ArtistService)
@Controller()
export class ArtistController {
    constructor(private readonly artistService: ArtistService) {}

    /**
     * 성우 등록
     */
    @Post('/artists')
    async create(@Body() body: ArtistCreateDto) {
        // 1. Destructure body, params, query
        const { name } = body;

        // 2. Get context

        // 3. Get result
        await this.artistService.create({ name });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 성우 목록 조회
     */
    @Get('/artists')
    async list() {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.artistService.list();

        // 4. Send response
        return { data };
    }
}
