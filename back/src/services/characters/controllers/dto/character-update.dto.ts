import type { CharacterRole } from '../../domain/character.entity';

export class CharacterUpdateDto {
    name?: string;
    role?: CharacterRole;
    imageUrl?: string;
}
