import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Episode } from '../../episodes/domain/episode.entity';

type Ctor = {
    episodeId: number;
    uuid: string;
    timeMs: number;
    params?: Record<string, unknown>;
};

@Entity('effects')
export class Effect extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '에피소드 id' })
    episodeId!: number;

    @Column({ comment: '이펙트 uuid' })
    uuid!: string;

    @Column({ comment: '이펙트 발생 시간(ms)' })
    timeMs!: number;

    @Column({ type: 'simple-json', comment: '이펙트 파라미터 JSON', nullable: true })
    params?: Record<string, unknown>;

    @ManyToOne(() => Episode, { nullable: false })
    @JoinColumn({ name: 'episodeId' })
    episode!: Episode;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.episodeId = args.episodeId;
            this.uuid = args.uuid;
            this.timeMs = args.timeMs;
            this.params = args.params;
        }
    }
}
