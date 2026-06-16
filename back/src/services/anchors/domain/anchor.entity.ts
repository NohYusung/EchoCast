import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Track } from '../../tracks/domain/track.entity';

type Ctor = {
    trackId: number;
    canvasId: number;
    time: number;
    position: number;
    index: number;
};

@Entity('anchors')
export class Anchor extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '트랙 id' })
    trackId!: number;

    @Column({ comment: '캔버스 id' })
    canvasId!: number;

    @Column({ comment: '타임라인 기준 시간' })
    time!: number;

    @Column({ type: 'real', comment: '미디어 높이 기준 위치 퍼센트' })
    position!: number;

    @Column({ comment: '캔버스 등록 미디어 정렬 인덱스' })
    index!: number;

    @ManyToOne(() => Track)
    @JoinColumn({ name: 'trackId' })
    track!: Track;

    @ManyToOne(() => Canvas)
    @JoinColumn({ name: 'canvasId' })
    canvas!: Canvas;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.trackId = args.trackId;
            this.canvasId = args.canvasId;
            this.time = args.time;
            this.position = args.position;
            this.index = args.index;
        }
    }

    update({
        canvasId,
        time,
        position,
        index,
    }: {
        canvasId?: number;
        time?: number;
        position?: number;
        index?: number;
    }) {
        const changedArgs = this.stripUnchanged({
            canvasId,
            time,
            position,
            index,
        });

        if (!changedArgs) {
            return;
        }

        Object.assign(this, changedArgs);
    }
}
