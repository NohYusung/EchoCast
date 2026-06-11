import type { CharacterRole } from '../../domain/character.entity';

export class CharacterCreateDto {
    name!: string;
    role?: CharacterRole;
    imageUrl?: string;
}
