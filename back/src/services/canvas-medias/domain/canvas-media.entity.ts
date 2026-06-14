import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Media } from '../../medias/domain/media.entity';

type Ctor = {
    canvasId: number;
    mediaId: number;
    index?: number;
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
        }
    }
}
