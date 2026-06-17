import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../../products/domain/product.entity';

export type CharacterRole = 'starring' | 'supporting' | 'minor' | 'narrator' | 'unknown';

type Ctor = {
    productId: number;
    name: string;
    role?: CharacterRole;
    imageUrl?: string;
};

@Entity('characters')
export class Character extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '작품 id' })
    productId!: number;

    @Column({ comment: '캐릭터 이름' })
    name!: string;

    @Column({ comment: '캐릭터 역할', default: 'unknown' })
    role!: CharacterRole;

    @Column({ comment: '캐릭터 이미지 URL', nullable: true })
    imageUrl?: string;

    @ManyToOne(() => Product, (product) => product.characters, { createForeignKeyConstraints: false })
    @JoinColumn({ name: 'productId' })
    product!: Product;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.productId = args.productId;
            this.name = args.name;
            this.role = args.role ?? 'unknown';
            this.imageUrl = args.imageUrl;
        }
    }

    update({ name, role, imageUrl }: { name?: string; role?: CharacterRole; imageUrl?: string }) {
        const changedArgs = this.stripUnchanged({
            name,
            role,
            imageUrl,
        });

        if (!changedArgs) {
            return;
        }

        Object.assign(this, changedArgs);
    }
}
