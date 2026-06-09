import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Product } from '../domain/product.entity';
import { ProductRepository } from '../repository/product.repository';
import { ProductService } from './product.service';

describe('ProductService', () => {
    it('creates products with generated numeric ids', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Product],
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
                            coverImageUrl: undefined,
                        },
                        {
                            id: 2,
                            title: 'Second product',
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
});
