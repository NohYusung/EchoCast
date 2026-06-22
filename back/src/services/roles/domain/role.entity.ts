import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Permission } from '../../permissions/domain/permission.entity';
import { User } from '../../users/domain/user.entity';

type Ctor = {
    name: string;
    description: string;
};

@Entity('roles')
export class Role extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '역할 이름' })
    name!: string;

    @Column({ comment: '역할 설명' })
    description!: string;

    @ManyToMany(() => Permission, (permission) => permission.roles)
    @JoinTable({
        name: 'role_permissions',
        joinColumn: { name: 'roleId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' },
    })
    permissions?: Permission[];

    @ManyToMany(() => User)
    @JoinTable({
        name: 'user_roles',
        joinColumn: { name: 'roleId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
    })
    users?: User[];

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.name = args.name;
            this.description = args.description;
        }
    }

    update({ name, description }: { name?: string; description?: string }) {
        const changedArgs = this.stripUnchanged({
            name,
            description,
        });

        if (!changedArgs) {
            return;
        }

        Object.assign(this, changedArgs);
    }
}
