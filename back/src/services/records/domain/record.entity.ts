import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Artist } from '../../artists/domain/artist.entity';
import { Cue } from '../../cues/domain/cue.entity';

type Ctor = {
    cueId: number;
    artistId: number;
    audioUrl: string;
    duration?: number;
    volume?: number;
};

@Entity('records')
export class Record extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '큐 id' })
    cueId!: number;

    @Column({ comment: '아티스트 id' })
    artistId!: number;

    @Column({ comment: '녹음 파일 URL' })
    audioUrl!: string;

    @Column({ comment: '녹음 파일 길이(ms)', nullable: true })
    duration?: number;

    @Column({ type: 'real', comment: '녹음 볼륨', default: 1 })
    volume!: number;

    @ManyToOne(() => Cue, { nullable: false })
    @JoinColumn({ name: 'cueId' })
    cue!: Cue;

    @ManyToOne(() => Artist, (artist) => artist.records, { nullable: false })
    @JoinColumn({ name: 'artistId' })
    artist!: Artist;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.cueId = args.cueId;
            this.artistId = args.artistId;
            this.audioUrl = args.audioUrl;
            this.duration = args.duration;
            this.volume = args.volume ?? 1;
        }
    }
}
