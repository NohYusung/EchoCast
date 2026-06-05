import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import type { CharacterDraft } from "../../player/domain/player-draft.types";

export type CharacterRole =
  | "starring"
  | "supporting"
  | "minor"
  | "narrator"
  | "unknown";

@Entity("characters")
export class CharacterEntity implements CharacterDraft {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ type: "varchar" })
  productId!: string;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "varchar", default: "#64748b" })
  color!: string;

  @Column({ type: "varchar", default: "unknown" })
  role!: CharacterRole;

  @Column({ type: "varchar", nullable: true })
  defaultTtsVoiceId?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
