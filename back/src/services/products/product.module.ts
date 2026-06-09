import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { ProductService } from './applications/product.service';
import { ProductController } from './controllers/product.controller';
import { ProductRepository } from './repository/product.repository';

@Module({
    imports: [DatabasesModule],
    controllers: [ProductController],
    providers: [
        {
            provide: ProductRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new ProductRepository(dataSource),
        },
        {
            provide: ProductService,
            inject: [ProductRepository],
            useFactory: (productRepository: ProductRepository) => new ProductService(productRepository),
        },
    ],
    exports: [ProductRepository, ProductService],
})
export class ProductModule {}
