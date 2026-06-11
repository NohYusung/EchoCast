import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Cue } from '../../cues/domain/cue.entity';
import { Episode } from '../../episodes/domain/episode.entity';

export type AudioType = 'audio' | 'bgm' | 'effect' | 'tts';

type Ctor = {
    episodeId: number;
    cueId?: number;
    audioType: AudioType;
    name: string;
    audioUrl: string;
    duration: number;
};

@Entity('audios')
export class Audio extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '에피소드 id' })
    episodeId!: number;

    @Column({ comment: '큐 id', nullable: true })
    cueId?: number;

    @Column({ comment: '오디오 타입' })
    audioType!: AudioType;

    @Column({ comment: '오디오 파일명' })
    name!: string;

    @Column({ comment: '오디오 파일 URL' })
    audioUrl!: string;

    @Column({ comment: '오디오 파일 길이(ms)' })
    duration!: number;

    @ManyToOne(() => Episode, { nullable: false })
    @JoinColumn({ name: 'episodeId' })
    episode!: Episode;

    @ManyToOne(() => Cue, { nullable: true })
    @JoinColumn({ name: 'cueId' })
    cue?: Cue;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.episodeId = args.episodeId;
            this.cueId = args.cueId;
            this.audioType = args.audioType;
            this.name = args.name;
            this.audioUrl = args.audioUrl;
            this.duration = args.duration;
        }
    }

    update({
        cueId,
        audioType,
        name,
        audioUrl,
        duration,
    }: {
        cueId?: number;
        audioType?: AudioType;
        name?: string;
        audioUrl?: string;
        duration?: number;
    }) {
        Object.assign(
            this,
            this.stripUnchanged({
                cueId,
                audioType,
                name,
                audioUrl,
                duration,
            })
        );
    }
}
