import { DddAggregate } from "../../../libs/ddd";
import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("scripts")
export class Script extends DddAggregate {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ type: "text" })
  script!: string;

  @Column({ type: "varchar" })
  characterId!: string;
}
