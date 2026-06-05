import { DddAggregate } from "../../../libs/ddd";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Product } from "../../products/domain/product.entity";

@Entity("episodes")
export class Episode extends DddAggregate {
  @PrimaryColumn({ type: "varchar" })
  id!: string;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: "productId" })
  product!: Product;

  @Column({ type: "varchar", comment: "프로덕트 id" })
  productId!: string;

  @Column({ type: "integer", comment: "에피소드 번호" })
  episodeNumber!: number;

  @Column({ type: "varchar", comment: "에피소드 제목" })
  title!: string;

  @Column({ type: "varchar", comment: "에피소드 부제", nullable: true })
  subTitle?: string;
}
