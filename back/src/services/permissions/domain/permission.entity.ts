import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../../roles/domain/role.entity';

type Ctor = {
    name: string;
    description: string;
};

@Entity('permissions')
export class Permission extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '권한 이름' })
    name!: string;

    @Column({ comment: '권한 설명' })
    description!: string;

    @ManyToMany(() => Role, (role) => role.permissions)
    roles?: Role[];

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
