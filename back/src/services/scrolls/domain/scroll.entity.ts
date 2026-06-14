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

    get canvasId() {
        return this.startAnchor?.canvasId ?? this.endAnchor?.canvasId;
    }

    get startIndex() {
        return this.startAnchor?.index;
    }

    get endIndex() {
        return this.endAnchor?.index;
    }

    get startTime() {
        return this.startAnchor?.time;
    }

    get endTime() {
        return this.endAnchor?.time;
    }

    get startPosition() {
        return this.startAnchor?.position;
    }

    get endPosition() {
        return this.endAnchor?.position;
    }

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
        Object.assign(
            this,
            this.stripUnchanged({
                startAnchorId,
                endAnchorId,
            })
        );
    }
}
