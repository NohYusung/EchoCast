import { Body, Controller, Delete, Dependencies, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { PermissionService } from '../applications/permission.service';
import { PermissionCreateDto, PermissionUpdateDto } from './dto';

@Dependencies(PermissionService)
@Controller()
export class PermissionController {
    constructor(private readonly permissionService: PermissionService) {}

    /**
     * 권한 등록
     */
    @Post('/permissions')
    async create(@Body() body: PermissionCreateDto) {
        // 1. Destructure body, params, query
        const { name, description } = body;

        // 2. Get context

        // 3. Get result
        await this.permissionService.create({ name, description });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 권한 목록 조회
     */
    @Get('/permissions')
    async list() {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.permissionService.list();

        // 4. Send response
        return { data };
    }

    /**
     * 권한 수정
     */
    @Put('/permissions/:permissionId')
    async update(@Param('permissionId', ParseIntPipe) permissionId: number, @Body() body: PermissionUpdateDto) {
        // 1. Destructure body, params, query
        const { name, description } = body;

        // 2. Get context

        // 3. Get result
        await this.permissionService.update({ permissionId, name, description });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 권한 삭제
     */
    @Delete('/permissions/:permissionId')
    async delete(@Param('permissionId', ParseIntPipe) permissionId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        await this.permissionService.delete({ permissionId });

        // 4. Send response
        return { data: {} };
    }
}
