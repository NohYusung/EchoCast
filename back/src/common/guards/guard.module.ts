import { Global, Module } from '@nestjs/common';
import { JwtHelperModule } from '../jwt-helper';
import { PermissionModule } from '../../services/permissions/permission.module';
import { PermissionGuard } from './permission.guard';

@Global()
@Module({
    imports: [JwtHelperModule, PermissionModule],
    providers: [PermissionGuard],
    exports: [PermissionGuard],
})
export class GuardModule {}
