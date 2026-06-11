import { DddAggregate } from '../../../libs/ddd';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

type Ctor = {
    provider: string;
    voiceName: string;
    voiceKey: string;
    languageCode: string;
    fileUrl?: string;
    metadata?: Record<string, unknown>;
};

@Entity('tts_voices')
export class TtsVoice extends DddAggregate {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ comment: 'TTS 제공자' })
    provider!: string;

    @Column({ comment: 'TTS 음성 이름' })
    voiceName!: string;

    @Column({ comment: 'TTS 음성 키' })
    voiceKey!: string;

    @Column({ comment: 'TTS 음성 언어 코드' })
    languageCode!: string;

    @Column({ comment: 'TTS 음성 데이터 URL', nullable: true })
    fileUrl?: string;

    /**
     * provider별 TTS 음성 생성/재생 옵션처럼 고정 컬럼으로 분리하지 않은 부가 정보를 보관한다.
     */
    @Column({
        type: 'simple-json',
        nullable: true,
        comment: 'provider별 TTS 음성 부가 정보 JSON',
    })
    metadata?: Record<string, unknown>;

    constructor(args?: Ctor) {
        super();
        if (args) {
            this.provider = args.provider;
            this.voiceName = args.voiceName;
            this.voiceKey = args.voiceKey;
            this.languageCode = args.languageCode;
            this.fileUrl = args.fileUrl;
            this.metadata = args.metadata;
        }
    }
}
