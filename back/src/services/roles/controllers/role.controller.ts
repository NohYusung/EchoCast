import { Body, Controller, Delete, Dependencies, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { RoleService } from '../applications/role.service';
import { RoleCreateDto, RoleUpdateDto } from './dto';

@Dependencies(RoleService)
@Controller()
export class RoleController {
    constructor(private readonly roleService: RoleService) {}

    /**
     * 역할 등록
     */
    @Post('/roles')
    async create(@Body() body: RoleCreateDto) {
        // 1. Destructure body, params, query
        const { name, description, permissionIds } = body;

        // 2. Get context

        // 3. Get result
        await this.roleService.create({ name, description, permissionIds });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 역할 목록 조회
     */
    @Get('/roles')
    async list() {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = await this.roleService.list();

        // 4. Send response
        return { data };
    }

    /**
     * 역할 수정
     */
    @Put('/roles/:roleId')
    async update(@Param('roleId', ParseIntPipe) roleId: number, @Body() body: RoleUpdateDto) {
        // 1. Destructure body, params, query
        const { name, description, permissionIds } = body;

        // 2. Get context

        // 3. Get result
        await this.roleService.update({ roleId, name, description, permissionIds });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 역할 삭제
     */
    @Delete('/roles/:roleId')
    async delete(@Param('roleId', ParseIntPipe) roleId: number) {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        await this.roleService.delete({ roleId });

        // 4. Send response
        return { data: {} };
    }
}
