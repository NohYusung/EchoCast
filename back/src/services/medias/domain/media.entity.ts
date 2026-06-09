import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Episode } from '../../episodes/domain/episode.entity';

export type MediaType = 'audio' | 'video' | 'image';

type Ctor = {
    episodeId: number;
    mediaType: MediaType;
    mediaUrl: string;
    index: number;
};

@Entity('medias')
export class Media extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '에피소드 id' })
    episodeId!: number;

    @Column({ comment: '미디어 타입' })
    mediaType!: MediaType;

    @Column({ comment: '미디어 url' })
    mediaUrl!: string;

    @Column({ comment: '미디어 정렬 인덱스' })
    index!: number;

    @ManyToOne(() => Episode, { nullable: false })
    @JoinColumn({ name: 'episodeId' })
    episode!: Episode;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.episodeId = args.episodeId;
            this.mediaType = args.mediaType;
            this.mediaUrl = args.mediaUrl;
            this.index = args.index;
        }
    }
}
