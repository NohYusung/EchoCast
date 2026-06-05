import { Module } from "@nestjs/common";
import { PlayerController } from "./controllers/player.controller";
import { PlayerService } from "./player.service";
import { ProductService } from "../products/applications/product.service";
import { ProductRepository } from "../products/repository/product.repository";

@Module({
  controllers: [PlayerController],
  providers: [
    PlayerService,
    {
      provide: ProductService,
      inject: [ProductRepository],
      useFactory: (productRepository: ProductRepository) =>
        new ProductService(productRepository),
    },
    {
      provide: ProductRepository,
      useFactory: () => new ProductRepository(),
    },
  ],
})
export class PlayerModule {}
