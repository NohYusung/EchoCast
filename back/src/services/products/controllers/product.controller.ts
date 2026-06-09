import { Body, Controller, Dependencies, Get, Post } from '@nestjs/common';
import { ProductService } from '../applications/product.service';
import { ProductCreateDto } from './dto';

@Dependencies(ProductService)
@Controller()
export class ProductController {
    constructor(private readonly productService: ProductService) {}

    /**
     * 작품 등록
     */
    @Post('/products')
    async create(@Body() body: ProductCreateDto) {
        // 1. Destructure body, params, query
        const { title, coverImageUrl } = body;

        // 2. Get context

        // 3. Get result
        await this.productService.create({ title, coverImageUrl });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 작품 목록 조회
     */
    @Get('/products')
    async list() {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.productService.list();

        // 4. Send response
        return { data };
    }
}
