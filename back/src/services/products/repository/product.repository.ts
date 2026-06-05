import { Injectable } from "@nestjs/common";
import { DddRepository } from "../../../libs/ddd";
import { stripUndefined } from "../../../libs/utils/helper";
import type { DataSource, FindManyOptions } from "typeorm";
import { Product } from "../domain/product.entity";

@Injectable()
export class ProductRepository extends DddRepository<Product> {
  constructor() {
    super(undefined as unknown as DataSource);
  }

  entityClass = Product;
  private readonly products = new Map<string, Product>();

  async find(
    conditions: {
      id?: string;
      title?: string;
      coverImageUrl?: string;
    },
    options?: Omit<FindManyOptions<Product>, "where">,
  ) {
    void options;
    const where = stripUndefined<Product>({
      id: conditions.id,
      title: conditions.title,
      coverImageUrl: conditions.coverImageUrl,
    });

    return Array.from(this.products.values())
      .filter((product) =>
        Object.entries(where).every(
          ([key, value]) => product[key as keyof Product] === value,
        ),
      )
      .map((product) => this.cloneProduct(product));
  }

  async count(conditions: {
    id?: string;
    title?: string;
    coverImageUrl?: string;
  }) {
    const products = await this.find(conditions);
    return products.length;
  }

  async save(products: Product[]) {
    for (const product of products) {
      this.products.set(product.id, this.cloneProduct(product));
    }
  }

  private cloneProduct(product: Product) {
    return Object.assign(new Product(), {
      id: product.id,
      title: product.title,
      coverImageUrl: product.coverImageUrl,
    });
  }
}
