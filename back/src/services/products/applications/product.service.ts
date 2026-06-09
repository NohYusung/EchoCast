import { Injectable } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Product } from '../domain/product.entity';
import { ProductRepository } from '../repository/product.repository';

@Injectable()
export class ProductService extends DddService {
    constructor(private readonly productRepository: ProductRepository) {
        super();
    }

    async create({ title, coverImageUrl }: { title: string; coverImageUrl?: string }) {
        const product = new Product({
            title,
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
            coverImageUrl: product.coverImageUrl ?? undefined,
        }));

        return { items, total };
    }
}
