import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Cue } from '../../cues/domain/cue.entity';
import { Episode } from '../../episodes/domain/episode.entity';

export type AudioType = 'audio' | 'bgm' | 'effect' | 'tts';

type Ctor = {
    episodeId: number;
    audioType: AudioType;
    name: string;
    audioUrl: string;
    duration?: number;
};

@Entity('audios')
export class Audio extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '에피소드 id' })
    episodeId!: number;

    @Column({ comment: '오디오 타입' })
    audioType!: AudioType;

    @Column({ comment: '오디오 파일명' })
    name!: string;

    @Column({ comment: '오디오 파일 URL' })
    audioUrl!: string;

    @Column({ comment: '오디오 파일 길이(ms)', nullable: true })
    duration?: number;

    @ManyToOne(() => Episode, { nullable: false })
    @JoinColumn({ name: 'episodeId' })
    episode!: Episode;

    @OneToMany(() => Cue, (cue) => cue.audio)
    cues?: Cue[];

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.episodeId = args.episodeId;
            this.audioType = args.audioType;
            this.name = args.name;
            this.audioUrl = args.audioUrl;
            this.duration = args.duration;
        }
    }

    update({
        audioType,
        name,
        audioUrl,
        duration,
    }: {
        audioType?: AudioType;
        name?: string;
        audioUrl?: string;
        duration?: number;
    }) {
        Object.assign(
            this,
            this.stripUnchanged({
                audioType,
                name,
                audioUrl,
                duration,
            })
        );
    }
}
