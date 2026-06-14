import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Audio } from '../../audios/domain/audio.entity';
import { Character } from '../../characters/domain/character.entity';
import { Track } from '../../tracks/domain/track.entity';

type Ctor = {
    script: string;
    characterId?: number;
    trackId: number;
    audioId?: number;
    startTime: number;
    endTime: number;
    ttsVoiceId?: number;
    volume?: number;
};

@Entity('cues')
export class Cue extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: '큐 대사' })
    script!: string;

    @Column({ comment: '캐릭터 id', nullable: true })
    characterId?: number;

    @Column({ comment: '트랙 id' })
    trackId!: number;

    @Column({ comment: '오디오 id', nullable: true })
    audioId?: number;

    @Column({ comment: '큐 시작 시간' })
    startTime!: number;

    @Column({ comment: '큐 종료 시간' })
    endTime!: number;

    @Column({ comment: 'TTS 음성 id', nullable: true })
    ttsVoiceId?: number;

    @Column({ type: 'real', comment: '큐 볼륨', default: 1 })
    volume!: number;

    @ManyToOne(() => Character, { nullable: true })
    @JoinColumn({ name: 'characterId' })
    character?: Character;

    @ManyToOne(() => Track, { nullable: false })
    @JoinColumn({ name: 'trackId' })
    track!: Track;

    @ManyToOne(() => Audio, (audio) => audio.cues, { nullable: true })
    @JoinColumn({ name: 'audioId' })
    audio?: Audio;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.script = args.script;
            this.characterId = args.characterId;
            this.trackId = args.trackId;
            this.audioId = args.audioId;
            this.startTime = args.startTime;
            this.endTime = args.endTime;
            this.ttsVoiceId = args.ttsVoiceId;
            this.volume = args.volume ?? 1;
        }
    }

    update({
        script,
        characterId,
        audioId,
        startTime,
        endTime,
        ttsVoiceId,
        volume,
    }: {
        script?: string;
        characterId?: number;
        audioId?: number;
        startTime?: number;
        endTime?: number;
        ttsVoiceId?: number;
        volume?: number;
    }) {
        Object.assign(
            this,
            this.stripUnchanged({
                script,
                characterId,
                audioId,
                startTime,
                endTime,
                ttsVoiceId,
                volume,
            })
        );
    }
}
