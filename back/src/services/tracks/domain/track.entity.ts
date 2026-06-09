import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Episode } from '../../episodes/domain/episode.entity';

export type TrackType = 'scroll' | 'record' | 'audio' | 'effect';

type Ctor = {
    episodeId: number;
    name: string;
    type: TrackType;
    isMuted?: boolean;
};

@Entity('tracks')
export class Track extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '에피소드 id' })
    episodeId!: number;

    @Column({ comment: '트랙 이름' })
    name!: string;

    @Column({ comment: '트랙 종류' })
    type!: TrackType;

    @Column({ type: 'boolean', comment: '트랙 음소거 여부', default: false })
    isMuted!: boolean;

    @ManyToOne(() => Episode, { nullable: false })
    @JoinColumn({ name: 'episodeId' })
    episode!: Episode;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.episodeId = args.episodeId;
            this.name = args.name;
            this.type = args.type;
            this.isMuted = args.isMuted ?? false;
        }
    }
}
