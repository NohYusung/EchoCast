import { DddAggregate } from "../../../libs/ddd";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

export type MediaType = "audio" | "video" | "image";

@Entity("medias")
export class Media extends DddAggregate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  mediaType!: MediaType;

  @Column({ type: "varchar" })
  mediaUrl!: string;

  @Column({ type: "integer" })
  startTime!: number;

  @Column({ type: "integer" })
  endTime!: number;
}
