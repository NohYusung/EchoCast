import { Injectable } from "@nestjs/common";
import { DddService } from "../../../libs/ddd";
import { Product } from "../domain/product.entity";
import { ProductRepository } from "../repository/product.repository";

@Injectable()
export class ProductService extends DddService {
  constructor(
    private readonly productRepository: ProductRepository,
  ) {
    super();
  }

  async createProduct({
    title,
    coverImageUrl,
  }: {
    title: string;
    coverImageUrl?: string;
  }) {
    const product = Object.assign(new Product(), {
      id: await this.nextProductId(),
      title,
      coverImageUrl,
    });

    await this.productRepository.save([product]);
    return {
      id: product.id,
      title: product.title,
      coverImageUrl: product.coverImageUrl,
    };
  }

  async saveProducts(
    products: Array<{
      id: string;
      title: string;
      coverImageUrl?: string;
    }>,
  ) {
    await this.productRepository.save(
      products.map((product) =>
        Object.assign(new Product(), {
          id: product.id,
          title: product.title,
          coverImageUrl: product.coverImageUrl,
        }),
      ),
    );
  }

  async hasProduct(productId: string) {
    return (await this.productRepository.count({ id: productId })) > 0;
  }

  private async nextProductId() {
    const products = await this.productRepository.find({});
    const maxExistingId = products.reduce((max, product) => {
      const match = product.id.match(/^product-(\d+)$/);
      const numericId = match ? Number(match[1]) : Number.NaN;
      return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
    }, 199);

    return `product-${maxExistingId + 1}`;
  }
}
