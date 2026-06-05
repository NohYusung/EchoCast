import { DddAggregate } from "../../../libs/ddd";
import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("cues")
export class Cue extends DddAggregate {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ type: "varchar" })
  episodeId!: string;

  @Column({ type: "varchar" })
  scriptId!: string;

  @Column({ type: "varchar" })
  characterId!: string;

  @Column({ type: "varchar" })
  trackId!: string;

  @Column({ type: "integer" })
  startTime!: number;

  @Column({ type: "integer" })
  endTime!: number;

  @Column({ type: "varchar", nullable: true })
  ttsVoiceId?: string;

  @Column({ type: "varchar", nullable: true })
  ttsUrl?: string;

  @Column({ type: "real", default: 1 })
  volume!: number;
}
