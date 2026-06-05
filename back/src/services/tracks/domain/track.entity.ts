import { DddAggregate } from "../../../libs/ddd";
import { Column, Entity, PrimaryColumn } from "typeorm";
import type { TrackKind } from "../../player/domain/player-contract.types";

@Entity("tracks")
export class Track extends DddAggregate {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @Column({ type: "varchar" })
  episodeId!: string;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "varchar" })
  kind!: TrackKind;

  @Column({ type: "integer" })
  layerId!: number;

  @Column({ type: "boolean", default: false })
  isMuted!: boolean;
}
