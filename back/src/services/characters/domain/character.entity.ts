import { DddAggregate } from "../../../libs/ddd";
import { Column, Entity, PrimaryColumn } from "typeorm";

export type CharacterRole =
  | "starring"
  | "supporting"
  | "minor"
  | "narrator"
  | "unknown";

@Entity("characters")
export class Character extends DddAggregate {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ type: "varchar" })
  productId!: string;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "varchar", default: "unknown" })
  role!: CharacterRole;
}
