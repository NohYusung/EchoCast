import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { PermissionService } from './applications/permission.service';
import { PermissionController } from './controllers/permission.controller';
import { PermissionRepository } from './repository/permission.repository';

@Module({
    imports: [DatabasesModule],
    controllers: [PermissionController],
    providers: [
        {
            provide: PermissionRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new PermissionRepository(dataSource),
        },
        {
            provide: PermissionService,
            inject: [PermissionRepository],
            useFactory: (permissionRepository: PermissionRepository) => new PermissionService(permissionRepository),
        },
    ],
    exports: [PermissionRepository, PermissionService],
})
export class PermissionModule {}
