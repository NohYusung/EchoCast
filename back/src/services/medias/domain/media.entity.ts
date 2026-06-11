import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Episode } from '../../episodes/domain/episode.entity';

export type MediaType = 'audio' | 'video' | 'image';

type Ctor = {
    episodeId: number;
    canvasId?: number;
    mediaType: MediaType;
    mediaUrl: string;
    index?: number;
};

@Entity('medias')
export class Media extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '에피소드 id' })
    episodeId!: number;

    @Column({ comment: '캔버스 id', nullable: true })
    canvasId?: number;

    @Column({ comment: '미디어 타입' })
    mediaType!: MediaType;

    @Column({ comment: '미디어 url' })
    mediaUrl!: string;

    @Column({ comment: '캔버스 등록 미디어 정렬 인덱스', nullable: true })
    index?: number;

    @ManyToOne(() => Episode, { nullable: false })
    @JoinColumn({ name: 'episodeId' })
    episode!: Episode;

    @ManyToOne(() => Canvas, (canvas) => canvas.medias, { nullable: true })
    @JoinColumn({ name: 'canvasId' })
    canvas?: Canvas;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.episodeId = args.episodeId;
            this.canvasId = args.canvasId;
            this.mediaType = args.mediaType;
            this.mediaUrl = args.mediaUrl;
            this.index = args.index;
        }
    }
}
