import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Anchor } from '../../anchors/domain/anchor.entity';
import { Track } from '../../tracks/domain/track.entity';

type Ctor = {
    trackId: number;
    anchorId: number;
    duration: number;
};

@Entity('pauses')
export class Pause extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '트랙 id' })
    trackId!: number;

    @Column({ comment: '정지 위치 앵커 id' })
    anchorId!: number;

    @Column({ comment: '정지 지속 시간' })
    duration!: number;

    @ManyToOne(() => Track, { nullable: false })
    @JoinColumn({ name: 'trackId' })
    track!: Track;

    @OneToOne(() => Anchor, { nullable: false })
    @JoinColumn({ name: 'anchorId' })
    anchor!: Anchor;

    get canvasId() {
        return this.anchor?.canvasId;
    }

    get index() {
        return this.anchor?.index;
    }

    get time() {
        return this.anchor?.time;
    }

    get position() {
        return this.anchor?.position;
    }

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.trackId = args.trackId;
            this.anchorId = args.anchorId;
            this.duration = args.duration;
        }
    }

    update({
        anchorId,
        duration,
    }: {
        anchorId?: number;
        duration?: number;
    }) {
        Object.assign(
            this,
            this.stripUnchanged({
                anchorId,
                duration,
            })
        );
    }
}
