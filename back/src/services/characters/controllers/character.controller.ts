import { Body, Controller, Delete, Dependencies, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { CharacterService } from '../applications/characater.service';
import { CharacterCreateDto, CharacterUpdateDto } from './dto';

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

    /**
     * 캐릭터 정보 수정
     */
    @Put('/products/:productId/characters/:characterId')
    async update(
        @Param('productId', ParseIntPipe) productId: number,
        @Param('characterId', ParseIntPipe) characterId: number,
        @Body() body: CharacterUpdateDto
    ) {
        // 1. Destructure body, params, query
        const { name, role, imageUrl } = body;

        // 2. Get context

        // 3. Get result
        await this.characterService.update({ productId, characterId, name, role, imageUrl });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 캐릭터 삭제
     */
    @Delete('/products/:productId/characters/:characterId')
    async delete(
        @Param('productId', ParseIntPipe) productId: number,
        @Param('characterId', ParseIntPipe) characterId: number
    ) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        await this.characterService.delete({ productId, characterId });

        // 4. Send response
        return { data: {} };
    }
}
