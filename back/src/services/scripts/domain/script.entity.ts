import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("scripts")
export class ScriptEntity {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ type: "text" })
  script!: string;

  @Column({ type: "varchar" })
  characterId!: string;
}
