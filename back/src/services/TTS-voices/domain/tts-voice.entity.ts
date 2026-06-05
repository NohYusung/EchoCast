import { DddAggregate } from "../../../libs/ddd";
import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from "typeorm";
import { Script } from "../../scripts/domain/script.entity";

@Entity("tts_voices")
export class TtsVoice extends DddAggregate {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ type: "varchar" })
  provider!: string;

  @Column({ type: "varchar" })
  voiceName!: string;

  @Column({ type: "varchar" })
  voiceKey!: string;

  @Column({ type: "varchar", comment: "TTS 음성 언어 코드" })
  languageCode!: string;

  @Column({ type: "varchar", comment: "TTS 음성 데이터 URL", nullable: true })
  fileUrl?: string;

  @OneToOne(() => Script, { nullable: false })
  @JoinColumn({ name: "scriptId" })
  script!: Script;

  @Column({ type: "varchar", comment: "스크립트 id" })
  scriptId!: string;

  /**
   * provider별 TTS 음성 생성/재생 옵션처럼 고정 컬럼으로 분리하지 않은 부가 정보를 보관한다.
   */
  @Column({
    type: "simple-json",
    nullable: true,
    comment: "provider별 TTS 음성 부가 정보 JSON",
  })
  metadata?: Record<string, unknown>;
}
