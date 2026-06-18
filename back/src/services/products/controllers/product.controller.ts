import { Body, Controller, Delete, Dependencies, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ProductService } from '../applications/product.service';
import { ProductCreateDto, ProductUpdateDto } from './dto';

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
        const { title, subtitle, coverImageUrl } = body;

        // 2. Get context

        // 3. Get result
        await this.productService.create({ title, subtitle, coverImageUrl });

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

    /**
     * 작품 상세 조회
     */
    @Get('/products/:productId')
    async retrieve(@Param('productId', ParseIntPipe) productId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.productService.retrieve({ productId });

        // 4. Send response
        return { data };
    }

    /**
     * 작품 정보 수정
     */
    @Put('/products/:productId')
    async update(@Param('productId', ParseIntPipe) productId: number, @Body() body: ProductUpdateDto) {
        // 1. Destructure body, params, query
        const { title, subtitle, coverImageUrl } = body;

        // 2. Get context

        // 3. Get result
        await this.productService.update({ productId, title, subtitle, coverImageUrl });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 작품 삭제
     */
    @Delete('/products/:productId')
    async delete(@Param('productId', ParseIntPipe) productId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        await this.productService.delete({ productId });

        // 4. Send response
        return { data: {} };
    }
}
