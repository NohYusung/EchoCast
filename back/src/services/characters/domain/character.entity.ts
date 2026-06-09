import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type CharacterRole = 'starring' | 'supporting' | 'minor' | 'narrator' | 'unknown';

type Ctor = {
    productId: string;
    name: string;
    role?: CharacterRole;
};

@Entity('characters')
export class Character extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '작품 id' })
    productId!: string;

    @Column({ comment: '캐릭터 이름' })
    name!: string;

    @Column({ comment: '캐릭터 역할', default: 'unknown' })
    role!: CharacterRole;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.productId = args.productId;
            this.name = args.name;
            this.role = args.role ?? 'unknown';
        }
    }
}
