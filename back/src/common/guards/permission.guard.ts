import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtHelperService } from '../jwt-helper';
import { PermissionRepository } from '../../services/permissions/repository/permission.repository';

export const PERMISSION_METADATA_KEY = 'permissions';
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSION_METADATA_KEY, permissions);
export const RequirePermissions = Permissions;

type RequestLike = {
    headers?: Record<string, string | string[] | undefined>;
    user?: {
        id?: number | string;
        userId?: number | string;
        sub?: number | string;
    };
};

@Injectable()
export class PermissionGuard implements CanActivate {
    constructor(
        private readonly permissionRepository: PermissionRepository,
        private readonly jwtHelper: JwtHelperService,
        private readonly reflector: Reflector
    ) {}

    async canActivate(executionContext: ExecutionContext) {
        const requiredPermissions =
            this.reflector.getAllAndOverride<string[]>(PERMISSION_METADATA_KEY, [
                executionContext.getHandler(),
                executionContext.getClass(),
            ]) ?? [];

        if (requiredPermissions.length === 0) {
            return true;
        }

        const request = executionContext.switchToHttp().getRequest<RequestLike>();
        const userId = this.resolveUserId(request);

        if (!userId) {
            throw new UnauthorizedException('인증 정보가 필요합니다.');
        }

        const permissions = await Promise.all(
            requiredPermissions.map(async (permissionName) => {
                const [permission] = await this.permissionRepository.find(
                    { name: permissionName },
                    { relations: { roles: { users: true } } }
                );

                return permission;
            })
        );

        const hasAllPermissions = permissions.every((permission) => {
            return permission?.roles?.some((role) => role.users?.some((user) => user.id === userId)) ?? false;
        });

        if (!hasAllPermissions) {
            throw new ForbiddenException('권한이 없습니다.');
        }

        return true;
    }

    private resolveUserId(request: RequestLike) {
        const requestUserId = request.user?.id ?? request.user?.userId ?? request.user?.sub;
        const parsedRequestUserId = Number(requestUserId);

        if (Number.isInteger(parsedRequestUserId) && parsedRequestUserId > 0) {
            return parsedRequestUserId;
        }

        const authorization = request.headers?.authorization ?? request.headers?.Authorization;
        const authorizationValue = Array.isArray(authorization) ? authorization[0] : authorization;
        const accessToken = authorizationValue?.startsWith('Bearer ') ? authorizationValue.slice('Bearer '.length) : undefined;
        const jwtPayload = accessToken ? this.jwtHelper.decodeAccessToken(accessToken) : undefined;
        const jwtUserId = jwtPayload?.userId ?? jwtPayload?.id ?? jwtPayload?.sub;
        const parsedJwtUserId = Number(jwtUserId);

        if (Number.isInteger(parsedJwtUserId) && parsedJwtUserId > 0) {
            return parsedJwtUserId;
        }

        if (process.env.NODE_ENV !== 'production') {
            const localUserId = request.headers?.['x-user-id'];
            const localUserIdValue = Array.isArray(localUserId) ? localUserId[0] : localUserId;
            const parsedLocalUserId = Number(localUserIdValue);

            if (Number.isInteger(parsedLocalUserId) && parsedLocalUserId > 0) {
                return parsedLocalUserId;
            }
        }

        return undefined;
    }
}
