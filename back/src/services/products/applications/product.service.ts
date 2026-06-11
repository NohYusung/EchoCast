import { Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Product } from '../domain/product.entity';
import { ProductRepository } from '../repository/product.repository';

@Injectable()
export class ProductService extends DddService {
    constructor(private readonly productRepository: ProductRepository) {
        super();
    }

    async create({ title, subtitle, coverImageUrl }: { title: string; subtitle?: string; coverImageUrl?: string }) {
        const product = new Product({
            title,
            subtitle,
            coverImageUrl,
        });

        await this.productRepository.save([product]);
    }

    async list() {
        const [products, total] = await Promise.all([
            this.productRepository.find({}),
            this.productRepository.count({}),
        ]);
        const items = products.map((product) => ({
            id: product.id,
            title: product.title,
            subtitle: product.subtitle ?? undefined,
            coverImageUrl: product.coverImageUrl ?? undefined,
        }));

        return { items, total };
    }

    async retrieve({ productId }: { productId: number }) {
        const [product] = await this.productRepository.find({ id: productId });

        if (!product) {
            throw new NotFoundException('Product not found.');
        }

        return {
            id: product.id,
            title: product.title,
            subtitle: product.subtitle ?? undefined,
            coverImageUrl: product.coverImageUrl ?? undefined,
        };
    }

    async update({
        productId,
        title,
        subtitle,
        coverImageUrl,
    }: {
        productId: number;
        title?: string;
        subtitle?: string;
        coverImageUrl?: string;
    }) {
        const [product] = await this.productRepository.find({ id: productId });

        if (!product) {
            throw new NotFoundException('Product not found.');
        }

        product.update({ title, subtitle, coverImageUrl });
        await this.productRepository.save([product]);
    }
}
