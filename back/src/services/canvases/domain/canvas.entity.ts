import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Episode } from '../../episodes/domain/episode.entity';
import { Media } from '../../medias/domain/media.entity';

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

    /*
    AGENT
    - manytomany로 수정. 
    - 한 미디어는 여러개의 캔버스 위에 올라가는게 가능하고, 
    - 한 캔버스는  여러개의 미디어를 갖는다. 
    */
    @OneToMany(() => Media, (media) => media.canvas)
    medias!: Media[];

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.episodeId = args.episodeId;
        }
    }
}
