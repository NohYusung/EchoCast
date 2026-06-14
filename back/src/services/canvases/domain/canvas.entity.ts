import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Episode } from '../../episodes/domain/episode.entity';

type Ctor = {
    episodeId: number;
};

@Entity('canvases')
export class Canvas extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '에피소드 id' })
    episodeId!: number;

    @ManyToOne(() => Episode, { nullable: false })
    @JoinColumn({ name: 'episodeId' })
    episode!: Episode;

    @OneToMany(() => CanvasMedia, (canvasMedia) => canvasMedia.canvas)
    canvasMedias!: CanvasMedia[];

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.episodeId = args.episodeId;
        }
    }
}
