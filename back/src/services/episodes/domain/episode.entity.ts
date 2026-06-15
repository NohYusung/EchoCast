import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../../products/domain/product.entity';

type Ctor = {
    productId: number;
    episodeNumber: number;
    title: string;
    subTitle?: string;
    thumbnailImageUrl?: string;
};

@Entity('episodes')
export class Episode extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '프로덕트 id' })
    productId!: number;

    @Column({ comment: '에피소드 번호' })
    episodeNumber!: number;

    @Column({ comment: '에피소드 제목' })
    title!: string;

    @Column({ comment: '에피소드 부제', nullable: true })
    subTitle?: string;

    @Column({ comment: '에피소드 썸네일 이미지 URL', nullable: true })
    thumbnailImageUrl?: string;

    @ManyToOne(() => Product, { nullable: false })
    @JoinColumn({ name: 'productId' })
    product!: Product;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.productId = args.productId;
            this.episodeNumber = args.episodeNumber;
            this.title = args.title;
            this.subTitle = args.subTitle;
            this.thumbnailImageUrl = args.thumbnailImageUrl;
        }
    }

    update({
        episodeNumber,
        title,
        subTitle,
        thumbnailImageUrl,
    }: {
        episodeNumber?: number;
        title?: string;
        subTitle?: string;
        thumbnailImageUrl?: string;
    }) {
        const changedArgs = this.stripUnchanged({
            episodeNumber,
            title,
            subTitle,
            thumbnailImageUrl,
        });

        if (!changedArgs) {
            return;
        }

        Object.assign(this, changedArgs);
    }
}
