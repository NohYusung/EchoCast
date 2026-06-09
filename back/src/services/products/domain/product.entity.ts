import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

type Ctor = {
    title: string;
    coverImageUrl?: string;
};

@Entity('products')
export class Product extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '작품 제목' })
    title!: string;

    @Column({ comment: '작품 커버 이미지 URL', nullable: true })
    coverImageUrl?: string;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.title = args.title;
            this.coverImageUrl = args.coverImageUrl;
        }
    }
}
