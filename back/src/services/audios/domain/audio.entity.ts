import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Episode } from '../../episodes/domain/episode.entity';
import { Track } from '../../tracks/domain/track.entity';

export type AudioType = 'audio' | 'bgm' | 'effect' | 'tts';

type Ctor = {
    episodeId: number;
    trackId?: number;
    audioType: AudioType;
    name: string;
    audioUrl: string;
    startTime?: number;
    endTime?: number;
    durationMs?: number;
    volume?: number;
    metadata?: Record<string, unknown>;
};

@Entity('audios')
export class Audio extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '에피소드 id' })
    episodeId!: number;

    @Column({ comment: '트랙 id', nullable: true })
    trackId?: number;

    @Column({ comment: '오디오 타입' })
    audioType!: AudioType;

    @Column({ comment: '오디오 이름' })
    name!: string;

    @Column({ comment: '오디오 파일 URL' })
    audioUrl!: string;

    @Column({ comment: '오디오 시작 시간(ms)', default: 0 })
    startTime!: number;

    @Column({ comment: '오디오 종료 시간(ms)', default: 0 })
    endTime!: number;

    @Column({ comment: '오디오 파일 길이(ms)', nullable: true })
    durationMs?: number;

    @Column({ type: 'real', comment: '오디오 볼륨', default: 1 })
    volume!: number;

    @Column({ type: 'simple-json', comment: '오디오 부가 정보 JSON', nullable: true })
    metadata?: Record<string, unknown>;

    @ManyToOne(() => Episode, { nullable: false })
    @JoinColumn({ name: 'episodeId' })
    episode!: Episode;

    @ManyToOne(() => Track, { nullable: true })
    @JoinColumn({ name: 'trackId' })
    track?: Track;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.episodeId = args.episodeId;
            this.trackId = args.trackId;
            this.audioType = args.audioType;
            this.name = args.name;
            this.audioUrl = args.audioUrl;
            this.startTime = args.startTime ?? 0;
            this.endTime = args.endTime ?? 0;
            this.durationMs = args.durationMs;
            this.volume = args.volume ?? 1;
            this.metadata = args.metadata;
        }
    }

    update({
        trackId,
        audioType,
        name,
        audioUrl,
        startTime,
        endTime,
        durationMs,
        volume,
        metadata,
    }: {
        trackId?: number;
        audioType?: AudioType;
        name?: string;
        audioUrl?: string;
        startTime?: number;
        endTime?: number;
        durationMs?: number;
        volume?: number;
        metadata?: Record<string, unknown>;
    }) {
        Object.assign(
            this,
            this.stripUnchanged({
                trackId,
                audioType,
                name,
                audioUrl,
                startTime,
                endTime,
                durationMs,
                volume,
                metadata,
            })
        );
    }
}
