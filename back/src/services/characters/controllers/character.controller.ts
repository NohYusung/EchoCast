import { Body, Controller, Dependencies, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CharacterService } from '../applications/characater.service';
import { CharacterCreateDto } from './dto';

@Dependencies(CharacterService)
@Controller()
export class CharacterController {
    constructor(private readonly characterService: CharacterService) {}

    /**
     * 캐릭터 등록
     */
    @Post('/products/:productId/characters')
    async create(@Param('productId', ParseIntPipe) productId: number, @Body() body: CharacterCreateDto) {
        // 1. Destructure body, params, query
        const { name, role, imageUrl } = body;

        // 2. Get context

        // 3. Get result
        await this.characterService.create({ productId, name, role, imageUrl });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 캐릭터 목록 조회
     */
    @Get('/products/:productId/characters')
    async list(@Param('productId', ParseIntPipe) productId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.characterService.list({ productId });

        // 4. Send response
        return { data };
    }
}
