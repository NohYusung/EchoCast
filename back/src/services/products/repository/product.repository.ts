import { Injectable } from '@nestjs/common';
import { DddRepository } from '../../../libs/ddd';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { stripUndefined } from '../../../libs/utils/helper';
import { Product } from '../domain/product.entity';

@Injectable()
export class ProductRepository extends DddRepository<Product> {
    entityClass = Product;

    async find(
        conditions: {
            id?: number;
            title?: string;
            subtitle?: string;
            coverImageUrl?: string;
        },
        options?: TypeormRelationOptions<Product>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Product>({
                id: conditions.id,
                title: conditions.title,
                subtitle: conditions.subtitle,
                coverImageUrl: conditions.coverImageUrl,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: { id?: number; title?: string; subtitle?: string; coverImageUrl?: string }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Product>({
                id: conditions.id,
                title: conditions.title,
                subtitle: conditions.subtitle,
                coverImageUrl: conditions.coverImageUrl,
            }),
        });
    }
}
