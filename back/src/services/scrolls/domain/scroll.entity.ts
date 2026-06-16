import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Anchor } from '../../anchors/domain/anchor.entity';
import { Track } from '../../tracks/domain/track.entity';

type Ctor = {
    trackId: number;
    startAnchorId: number;
    endAnchorId: number;
};

@Entity('scrolls')
export class Scroll extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '트랙 id' })
    trackId!: number;

    @Column({ comment: '스크롤 시작 앵커 id' })
    startAnchorId!: number;

    @Column({ comment: '스크롤 종료 앵커 id' })
    endAnchorId!: number;

    @ManyToOne(() => Track, { nullable: false })
    @JoinColumn({ name: 'trackId' })
    track!: Track;

    @OneToOne(() => Anchor, { nullable: false })
    @JoinColumn({ name: 'startAnchorId' })
    startAnchor!: Anchor;

    @ManyToOne(() => Anchor, { nullable: false })
    @JoinColumn({ name: 'endAnchorId' })
    endAnchor!: Anchor;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.trackId = args.trackId;
            this.startAnchorId = args.startAnchorId;
            this.endAnchorId = args.endAnchorId;
        }
    }

    update({
        startAnchorId,
        endAnchorId,
    }: {
        startAnchorId?: number;
        endAnchorId?: number;
    }) {
        const changedArgs = this.stripUnchanged({
            startAnchorId,
            endAnchorId,
        });

        if (!changedArgs) {
            return;
        }

        Object.assign(this, changedArgs);
    }
}
