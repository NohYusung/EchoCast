import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Character } from '../../characters/domain/character.entity';
import { Track } from '../../tracks/domain/track.entity';

type Ctor = {
    script: string;
    characterId: number;
    trackId: number;
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

    @Column({ comment: '캐릭터 id' })
    characterId!: number;

    @Column({ comment: '트랙 id' })
    trackId!: number;

    @Column({ comment: '큐 시작 시간' })
    startTime!: number;

    @Column({ comment: '큐 종료 시간' })
    endTime!: number;

    @Column({ comment: 'TTS 음성 id', nullable: true })
    ttsVoiceId?: number;

    @Column({ type: 'real', comment: '큐 볼륨', default: 1 })
    volume!: number;

    @ManyToOne(() => Character, { nullable: false })
    @JoinColumn({ name: 'characterId' })
    character!: Character;

    @ManyToOne(() => Track, { nullable: false })
    @JoinColumn({ name: 'trackId' })
    track!: Track;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.script = args.script;
            this.characterId = args.characterId;
            this.trackId = args.trackId;
            this.startTime = args.startTime;
            this.endTime = args.endTime;
            this.ttsVoiceId = args.ttsVoiceId;
            this.volume = args.volume ?? 1;
        }
    }

    update({
        script,
        characterId,
        startTime,
        endTime,
        ttsVoiceId,
        volume,
    }: {
        script?: string;
        characterId?: number;
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
                startTime,
                endTime,
                ttsVoiceId,
                volume,
            })
        );
    }
}
