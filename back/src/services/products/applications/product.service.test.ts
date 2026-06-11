import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Character } from '../../characters/domain/character.entity';
import { Product } from '../domain/product.entity';
import { ProductRepository } from '../repository/product.repository';
import { ProductService } from './product.service';

describe('ProductService', () => {
    it('creates products with generated numeric ids', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Character, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const productRepository = new ProductRepository(dataSource);
            const productService = new ProductService(productRepository);

            await productService.create({
                title: 'First product',
            });
            await productService.create({
                title: 'Second product',
                subtitle: 'Second subtitle',
                coverImageUrl: 'https://assets.example.com/cover.png',
            });

            const storedProducts = await productService.list();
            assert.deepEqual(
                storedProducts,
                {
                    items: [
                        {
                            id: 1,
                            title: 'First product',
                            subtitle: undefined,
                            coverImageUrl: undefined,
                        },
                        {
                            id: 2,
                            title: 'Second product',
                            subtitle: 'Second subtitle',
                            coverImageUrl: 'https://assets.example.com/cover.png',
                        },
                    ],
                    total: 2,
                }
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('loads characters through the product relation', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Character, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const productRepository = new ProductRepository(dataSource);
            const product = await dataSource.manager.save(
                new Product({
                    title: 'Character relation product',
                })
            );
            await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: '나리',
                    role: 'starring',
                })
            );

            const [storedProduct] = await productRepository.find({ id: product.id }, { relations: { characters: true } });

            const characters = (storedProduct as Product & { characters: Character[] }).characters;
            assert.equal(characters.length, 1);
            assert.equal(characters[0].name, '나리');
        } finally {
            await dataSource.destroy();
        }
    });

    it('retrieves a product by id', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Character, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const productRepository = new ProductRepository(dataSource);
            const productService = new ProductService(productRepository);
            const product = await dataSource.manager.save(
                new Product({
                    title: 'Retrieved product',
                    subtitle: 'Retrieved subtitle',
                    coverImageUrl: 'https://assets.example.com/retrieve.png',
                })
            );

            const retrievedProduct = await productService.retrieve({ productId: product.id });

            assert.deepEqual(retrievedProduct, {
                id: product.id,
                title: 'Retrieved product',
                subtitle: 'Retrieved subtitle',
                coverImageUrl: 'https://assets.example.com/retrieve.png',
            });
        } finally {
            await dataSource.destroy();
        }
    });

    it('updates product title and cover image', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Character, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const productRepository = new ProductRepository(dataSource);
            const productService = new ProductService(productRepository);
            const product = await dataSource.manager.save(
                new Product({
                    title: 'Before title',
                    subtitle: 'Before subtitle',
                    coverImageUrl: 'https://assets.example.com/before.png',
                })
            );

            await productService.update({
                productId: product.id,
                title: 'After title',
                subtitle: 'After subtitle',
                coverImageUrl: 'https://assets.example.com/after.png',
            });

            const [storedProduct] = await productRepository.find({ id: product.id });

            assert.equal(storedProduct.title, 'After title');
            assert.equal(storedProduct.subtitle, 'After subtitle');
            assert.equal(storedProduct.coverImageUrl, 'https://assets.example.com/after.png');
        } finally {
            await dataSource.destroy();
        }
    });

    it('throws NotFoundException when retrieving a missing product', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Character, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const productRepository = new ProductRepository(dataSource);
            const productService = new ProductService(productRepository);

            await assert.rejects(
                () =>
                    productService.retrieve({
                        productId: 9999,
                    }),
                (error: unknown) => error instanceof NotFoundException
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('throws NotFoundException when updating a missing product', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Character, Product],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const productRepository = new ProductRepository(dataSource);
            const productService = new ProductService(productRepository);

            await assert.rejects(
                () =>
                    productService.update({
                        productId: 9999,
                        title: 'Missing product',
                    }),
                (error: unknown) => error instanceof NotFoundException
            );
        } finally {
            await dataSource.destroy();
        }
    });
});
