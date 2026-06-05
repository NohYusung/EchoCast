import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import type { CueDraft } from "../../player/domain/player-draft.types";

@Entity("cues")
export class CueEntity implements CueDraft {
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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
