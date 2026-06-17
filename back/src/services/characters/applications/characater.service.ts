import { Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Character, type CharacterRole } from '../domain/character.entity';
import { CharacterRepository } from '../repository/characater.repository';

@Injectable()
export class CharacterService extends DddService {
    constructor(private readonly characterRepository: CharacterRepository) {
        super();
    }

    async create({ productId, name, role, imageUrl }: { productId: number; name: string; role?: CharacterRole; imageUrl?: string }) {
        const character = new Character({
            productId,
            name,
            role,
            imageUrl,
        });

        await this.characterRepository.save([character]);
        return {
            id: character.id,
            productId: character.productId,
            name: character.name,
            role: character.role,
            imageUrl: character.imageUrl ?? undefined,
        };
    }

    async list({ productId }: { productId: number }) {
        const [characters, total] = await Promise.all([
            this.characterRepository.find({ productId }),
            this.characterRepository.count({ productId }),
        ]);
        const items = characters.map((character) => ({
            id: character.id,
            productId: character.productId,
            name: character.name,
            role: character.role,
            imageUrl: character.imageUrl ?? undefined,
        }));

        return { items, total };
    }

    async update({
        productId,
        characterId,
        name,
        role,
        imageUrl,
    }: {
        productId: number;
        characterId: number;
        name?: string;
        role?: CharacterRole;
        imageUrl?: string;
    }) {
        const [character] = await this.characterRepository.find({ id: characterId, productId });

        if (!character) {
            throw new NotFoundException('캐릭터를 찾을 수 없습니다.');
        }

        character.update({ name, role, imageUrl });
        await this.characterRepository.save([character]);
    }

    async delete({ productId, characterId }: { productId: number; characterId: number }) {
        const [character] = await this.characterRepository.find({ id: characterId, productId });

        if (!character) {
            throw new NotFoundException('캐릭터를 찾을 수 없습니다.');
        }

        await this.characterRepository.softRemove([character]);
    }
}
