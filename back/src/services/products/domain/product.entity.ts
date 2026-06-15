import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Character } from '../../characters/domain/character.entity';

type Ctor = {
    title: string;
    subtitle?: string;
    coverImageUrl?: string;
};

@Entity('products')
export class Product extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '작품 제목' })
    title!: string;

    @Column({ comment: '작품 부제목', nullable: true })
    subtitle?: string;

    @Column({ comment: '작품 커버 이미지 URL', nullable: true })
    coverImageUrl?: string;

    @OneToMany(() => Character, (character) => character.product)
    characters!: Character[];

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.title = args.title;
            this.subtitle = args.subtitle;
            this.coverImageUrl = args.coverImageUrl;
        }
    }

    update({
        title,
        subtitle,
        coverImageUrl,
    }: {
        title?: string;
        subtitle?: string;
        coverImageUrl?: string;
    }) {
        const changedArgs = this.stripUnchanged({
            title,
            subtitle,
            coverImageUrl,
        });

        if (!changedArgs) {
            return;
        }

        Object.assign(this, changedArgs);
    }
}
