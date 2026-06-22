export class RoleCreateDto {
    name!: string;

    description!: string;

    permissionIds?: number[];
}
