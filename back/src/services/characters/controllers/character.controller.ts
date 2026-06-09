import { Body, Controller, Inject, Param, Post } from '@nestjs/common';
import { CharacterService } from '../applications/characater.service';
import { CharacterCreateDto } from './dto';

@Controller()
export class CharacterController {
    constructor(
        @Inject(CharacterService)
        private readonly characterService: CharacterService
    ) {}

    /**
     * 캐릭터 등록
     */
    @Post('/products/:productId/characters')
    async create(@Param('productId') productId: string, @Body() body: CharacterCreateDto) {
        // 1. Destructure body, params, query
        const { name, role } = body;

        // 2. Get context

        // 3. Get result
        const data = await this.characterService.create({ productId, name, role });
        void data;

        // 4. Send response
        return { data: {} };
    }
}
