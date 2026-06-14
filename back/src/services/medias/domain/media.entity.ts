import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Episode } from '../../episodes/domain/episode.entity';

export type MediaType = 'audio' | 'video' | 'image';

type Ctor = {
    episodeId: number;
    mediaName: string;
    mediaType: MediaType;
    mediaUrl: string;
    duration?: number;
};

@Entity('medias')
export class Media extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '에피소드 id' })
    episodeId!: number;

    @Column({ comment: '미디어 파일명' })
    mediaName!: string;

    @Column({ comment: '미디어 타입' })
    mediaType!: MediaType;

    @Column({ comment: '비디오 미디어 길이(ms)', nullable: true })
    duration?: number;

    @Column({ comment: '미디어 url' })
    mediaUrl!: string;

    @ManyToOne(() => Episode, { nullable: false })
    @JoinColumn({ name: 'episodeId' })
    episode!: Episode;

    @OneToMany(() => CanvasMedia, (canvasMedia) => canvasMedia.media)
    canvasMedias?: CanvasMedia[];

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.episodeId = args.episodeId;
            this.mediaName = args.mediaName;
            this.mediaType = args.mediaType;
            this.mediaUrl = args.mediaUrl;
            this.duration = args.duration;
        }
    }
}
