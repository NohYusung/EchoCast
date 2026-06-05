import { DddAggregate } from "../../../libs/ddd";
import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("products")
export class Product extends DddAggregate {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "varchar", nullable: true })
  coverImageUrl?: string;
}
