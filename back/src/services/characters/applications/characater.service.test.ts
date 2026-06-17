import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Product } from '../../products/domain/product.entity';
import { Character } from '../domain/character.entity';
import { CharacterRepository } from '../repository/characater.repository';
import { CharacterService } from './characater.service';

describe('CharacterService', () => {
    it('updates character name, role, and image URL', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Character, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const characterRepository = new CharacterRepository(dataSource);
            const characterService = new CharacterService(characterRepository);
            const product = await dataSource.manager.save(new Product({ title: 'Character update product' }));
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Before character',
                    role: 'minor',
                    imageUrl: 'https://assets.example.com/characters/before.png',
                })
            );

            await characterService.update({
                productId: product.id,
                characterId: character.id,
                name: 'After character',
                role: 'supporting',
                imageUrl: 'https://assets.example.com/characters/after.png',
            });

            const [storedCharacter] = await characterRepository.find({ id: character.id, productId: product.id });

            assert.equal(storedCharacter.name, 'After character');
            assert.equal(storedCharacter.role, 'supporting');
            assert.equal(storedCharacter.imageUrl, 'https://assets.example.com/characters/after.png');
        } finally {
            await dataSource.destroy();
        }
    });

    it('throws NotFoundException when updating a missing character', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Character, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const characterRepository = new CharacterRepository(dataSource);
            const characterService = new CharacterService(characterRepository);

            await assert.rejects(
                () =>
                    characterService.update({
                        productId: 1,
                        characterId: 9999,
                        name: 'Missing character',
                    }),
                (error: unknown) => error instanceof NotFoundException
            );
        } finally {
            await dataSource.destroy();
        }
    });
});
