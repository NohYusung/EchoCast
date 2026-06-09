import { Injectable } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Character, type CharacterRole } from '../domain/character.entity';
import { CharacterRepository } from '../repository/characater.repository';

@Injectable()
export class CharacterService extends DddService {
    constructor(private readonly characterRepository: CharacterRepository) {
        super();
    }

    async create({ productId, name, role }: { productId: string; name: string; role?: CharacterRole }) {
        const character = new Character({
            productId,
            name,
            role,
        });

        await this.characterRepository.save([character]);
        return {
            id: character.id,
            productId: character.productId,
            name: character.name,
            role: character.role,
        };
    }
}
