import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Media } from '../../medias/domain/media.entity';

type Ctor = {
    canvasId: number;
    mediaId: number;
    index?: number;
    startTime?: number;
    endTime?: number;
    sourceStartTime?: number;
    sourceEndTime?: number;
    volume?: number;
    isMuted?: boolean;
};

@Entity('canvas_medias')
export class CanvasMedia extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '캔버스 id' })
    canvasId!: number;

    @Column({ comment: '미디어 id' })
    mediaId!: number;

    @Column({ comment: '캔버스 내부 미디어 정렬 인덱스', nullable: true })
    index?: number;

    @Column({ comment: '타임라인 시작 시간(ms)', nullable: true })
    startTime?: number;

    @Column({ comment: '타임라인 종료 시간(ms)', nullable: true })
    endTime?: number;

    @Column({ comment: '원본 미디어 재생 시작 시간(ms)', nullable: true })
    sourceStartTime?: number;

    @Column({ comment: '원본 미디어 재생 종료 시간(ms)', nullable: true })
    sourceEndTime?: number;

    @Column({ type: 'real', comment: '캔버스 미디어 재생 음량', nullable: true })
    volume?: number;

    @Column({ comment: '캔버스 미디어 음소거 여부', nullable: true })
    isMuted?: boolean;

    @ManyToOne(() => Canvas, (canvas) => canvas.canvasMedias, { nullable: false })
    @JoinColumn({ name: 'canvasId' })
    canvas!: Canvas;

    @ManyToOne(() => Media, (media) => media.canvasMedias, { nullable: false })
    @JoinColumn({ name: 'mediaId' })
    media!: Media;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.canvasId = args.canvasId;
            this.mediaId = args.mediaId;
            this.index = args.index;
            this.startTime = args.startTime;
            this.endTime = args.endTime;
            this.sourceStartTime = args.sourceStartTime;
            this.sourceEndTime = args.sourceEndTime;
            this.volume = args.volume;
            this.isMuted = args.isMuted;
        }
    }
}
