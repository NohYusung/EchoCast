import { Module } from "@nestjs/common";
import { ProductService } from "./applications/product.service";
import { ProductRepository } from "./repository/product.repository";

@Module({
  imports: [],
  controllers: [],
  providers: [
    {
      provide: ProductRepository,
      useFactory: () => new ProductRepository(),
    },
    {
      provide: ProductService,
      inject: [ProductRepository],
      useFactory: (productRepository: ProductRepository) =>
        new ProductService(productRepository),
    },
  ],
  exports: [ProductRepository, ProductService],
})
export class ProductModule {}
