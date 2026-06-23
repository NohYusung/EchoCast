import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Audio } from '../../audios/domain/audio.entity';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { Character } from '../../characters/domain/character.entity';
import { Script } from '../../scripts/domain/script.entity';
import { Track } from '../../tracks/domain/track.entity';

type Ctor = {
    scriptId?: number | null;
    characterId?: number;
    trackId: number;
    audioId?: number | null;
    startCanvasMediaId?: number;
    endCanvasMediaId?: number;
    startTime?: number;
    endTime?: number;
    audioStartTime?: number;
    audioEndTime?: number;
    startPosition?: number;
    endPosition?: number;
    volume?: number;
};

@Entity('cues')
export class Cue extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '대사 id', nullable: true })
    scriptId?: number | null;

    @Column({ comment: '캐릭터 id', nullable: true })
    characterId?: number;

    @Column({ comment: '트랙 id' })
    trackId!: number;

    @Column({ comment: '오디오 id', nullable: true })
    audioId?: number | null;

    @Column({ comment: '큐 시작 위치가 속한 캔버스 미디어 id', nullable: true })
    startCanvasMediaId?: number;

    @Column({ comment: '큐 종료 위치가 속한 캔버스 미디어 id', nullable: true })
    endCanvasMediaId?: number;

    @Column({ comment: '큐 시작 시간', nullable: true })
    startTime?: number;

    @Column({ comment: '큐 종료 시간', nullable: true })
    endTime?: number;

    @Column({ comment: '원본 오디오 시작 시간', nullable: true })
    audioStartTime?: number;

    @Column({ comment: '원본 오디오 종료 시간', nullable: true })
    audioEndTime?: number;

    @Column({ type: 'real', comment: '큐 시작 위치의 캔버스 미디어 높이 기준 퍼센트', default: 0 })
    startPosition!: number;

    @Column({ type: 'real', comment: '큐 종료 위치의 캔버스 미디어 높이 기준 퍼센트', default: 0 })
    endPosition!: number;

    @Column({ type: 'real', comment: '큐 볼륨', default: 1 })
    volume!: number;

    @ManyToOne(() => Character, { nullable: true })
    @JoinColumn({ name: 'characterId' })
    character?: Character;

    @ManyToOne(() => Script, { nullable: true })
    @JoinColumn({ name: 'scriptId' })
    scriptRef?: Script | null;

    @ManyToOne(() => Track)
    @JoinColumn({ name: 'trackId' })
    track!: Track;

    @ManyToOne(() => Audio, (audio) => audio.cues, { nullable: true })
    @JoinColumn({ name: 'audioId' })
    audio?: Audio | null;

    @ManyToOne(() => CanvasMedia, { nullable: true })
    @JoinColumn({ name: 'startCanvasMediaId' })
    startCanvasMedia?: CanvasMedia;

    @ManyToOne(() => CanvasMedia, { nullable: true })
    @JoinColumn({ name: 'endCanvasMediaId' })
    endCanvasMedia?: CanvasMedia;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.scriptId = args.scriptId;
            this.characterId = args.characterId;
            this.trackId = args.trackId;
            this.audioId = args.audioId;
            this.startCanvasMediaId = args.startCanvasMediaId;
            this.endCanvasMediaId = args.endCanvasMediaId ?? args.startCanvasMediaId;
            this.startTime = args.startTime;
            this.endTime = args.endTime;
            this.audioStartTime = args.audioStartTime;
            this.audioEndTime = args.audioEndTime;
            this.startPosition = args.startPosition ?? 0;
            this.endPosition = args.endPosition ?? this.startPosition;
            this.volume = args.volume ?? 1;
        }
    }

    update({
        scriptId,
        characterId,
        trackId,
        audioId,
        startCanvasMediaId,
        endCanvasMediaId,
        startTime,
        endTime,
        audioStartTime,
        audioEndTime,
        startPosition,
        endPosition,
        volume,
    }: {
        scriptId?: number | null;
        characterId?: number;
        trackId?: number;
        audioId?: number | null;
        startCanvasMediaId?: number;
        endCanvasMediaId?: number;
        startTime?: number;
        endTime?: number;
        audioStartTime?: number;
        audioEndTime?: number;
        startPosition?: number;
        endPosition?: number;
        volume?: number;
    }) {
        const changedArgs = this.stripUnchanged({
            scriptId,
            characterId,
            trackId,
            audioId,
            startCanvasMediaId,
            endCanvasMediaId,
            startTime,
            endTime,
            audioStartTime,
            audioEndTime,
            startPosition,
            endPosition,
            volume,
        });

        if (!changedArgs) {
            return;
        }

        Object.assign(this, changedArgs);
    }
}
