import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Artist } from '../../artists/domain/artist.entity';
import { Cue } from '../../cues/domain/cue.entity';

type Ctor = {
    cueId: number;
    artistId?: number | null;
    recordUrl: string;
    duration?: number;
    volume?: number;
    isAccepted?: boolean;
};

@Entity('records')
export class Record extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '큐 id' })
    cueId!: number;

    @Column({ comment: '아티스트 id', nullable: true })
    artistId!: number | null;

    @Column({ comment: '녹음 파일 URL' })
    recordUrl!: string;

    @Column({ comment: '녹음 파일 길이(ms)', nullable: true })
    duration?: number;

    @Column({ type: 'real', comment: '녹음 볼륨', default: 1 })
    volume!: number;

    @Column({ comment: '채택 여부', default: false })
    isAccepted!: boolean;

    @ManyToOne(() => Cue, { nullable: false })
    @JoinColumn({ name: 'cueId' })
    cue!: Cue;

    @ManyToOne(() => Artist, (artist) => artist.records, { nullable: true })
    @JoinColumn({ name: 'artistId' })
    artist!: Artist | null;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.cueId = args.cueId;
            this.artistId = args.artistId ?? null;
            this.recordUrl = args.recordUrl;
            this.duration = args.duration;
            this.volume = args.volume ?? 1;
            this.isAccepted = args.isAccepted ?? false;
        }
    }

    update({
        cueId,
        artistId,
        recordUrl,
        duration,
        volume,
        isAccepted,
    }: {
        cueId?: number;
        artistId?: number | null;
        recordUrl?: string;
        duration?: number;
        volume?: number;
        isAccepted?: boolean;
    }) {
        const changedArgs = this.stripUnchanged({
            cueId,
            artistId,
            recordUrl,
            duration,
            volume,
            isAccepted,
        });

        if (!changedArgs) {
            return;
        }

        Object.assign(this, changedArgs);
    }
}
