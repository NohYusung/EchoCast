import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Track } from '../../tracks/domain/track.entity';

type Ctor = {
    trackId: number;
    startTime: number;
    endTime: number;
    startPosition: number;
    endPosition: number;
};

@Entity('scrolls')
export class Scroll extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '트랙 id' })
    trackId!: number;

    @Column({ comment: '스크롤 시작 시간' })
    startTime!: number;

    @Column({ comment: '스크롤 종료 시간' })
    endTime!: number;

    @Column({ comment: '스크롤 시작 위치' })
    startPosition!: number;

    @Column({ comment: '스크롤 종료 위치' })
    endPosition!: number;

    @ManyToOne(() => Track, { nullable: false })
    @JoinColumn({ name: 'trackId' })
    track!: Track;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.trackId = args.trackId;
            this.startTime = args.startTime;
            this.endTime = args.endTime;
            this.startPosition = args.startPosition;
            this.endPosition = args.endPosition;
        }
    }
}
