import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { PermissionModule } from '../permissions/permission.module';
import { PermissionRepository } from '../permissions/repository/permission.repository';
import { RoleService } from './applications/role.service';
import { RoleController } from './controllers/role.controller';
import { RoleRepository } from './repository/role.repository';

@Module({
    imports: [DatabasesModule, PermissionModule],
    controllers: [RoleController],
    providers: [
        {
            provide: RoleRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new RoleRepository(dataSource),
        },
        {
            provide: RoleService,
            inject: [RoleRepository, PermissionRepository],
            useFactory: (roleRepository: RoleRepository, permissionRepository: PermissionRepository) =>
                new RoleService(roleRepository, permissionRepository),
        },
    ],
    exports: [RoleRepository, RoleService],
})
export class RoleModule {}
