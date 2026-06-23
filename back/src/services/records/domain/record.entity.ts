import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Audio } from '../../audios/domain/audio.entity';
import { Cue } from '../../cues/domain/cue.entity';
import { User } from '../../users/domain/user.entity';

type Ctor = {
    cueId: number;
    artistId?: number | null;
    audioId: number;
    isAccepted?: boolean;
};

@Entity('records')
export class Record extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '큐 id' })
    cueId!: number;

    @Column({ comment: '아티스트 사용자 id', nullable: true })
    artistId!: number | null;

    @Column({ comment: '녹음 오디오 id', nullable: true })
    audioId?: number | null;

    @Column({ comment: '채택 여부', default: false })
    isAccepted!: boolean;

    @ManyToOne(() => Cue)
    @JoinColumn({ name: 'cueId' })
    cue!: Cue;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'artistId' })
    artist!: User | null;

    @OneToOne(() => Audio, { nullable: true })
    @JoinColumn({ name: 'audioId' })
    audio?: Audio | null;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.cueId = args.cueId;
            this.artistId = args.artistId ?? null;
            this.audioId = args.audioId;
            this.isAccepted = args.isAccepted ?? false;
        }
    }

    update({
        cueId,
        artistId,
        audioId,
        isAccepted,
    }: {
        cueId?: number;
        artistId?: number | null;
        audioId?: number;
        isAccepted?: boolean;
    }) {
        const changedArgs = this.stripUnchanged({
            cueId,
            artistId,
            audioId,
            isAccepted,
        });

        if (!changedArgs) {
            return;
        }

        Object.assign(this, changedArgs);
    }
}
