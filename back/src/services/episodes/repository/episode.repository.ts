import { Injectable } from "@nestjs/common";
import { DddRepository } from "../../../libs/ddd";
import { stripUndefined } from "../../../libs/utils/helper";
import type { FindManyOptions } from "typeorm";
import { Episode } from "../domain/episode.entity";

@Injectable()
export class EpisodeRepository extends DddRepository<Episode> {
  entityClass = Episode;

  async find(
    conditions: {
      id?: string;
      productId?: string;
      episodeNumber?: number;
      title?: string;
      subTitle?: string;
    },
    options?: Omit<FindManyOptions<Episode>, "where">,
  ) {
    return this.entityManager.find(this.entityClass, {
      where: stripUndefined<Episode>({
        id: conditions.id,
        productId: conditions.productId,
        episodeNumber: conditions.episodeNumber,
        title: conditions.title,
        subTitle: conditions.subTitle,
      }),
      ...options,
    });
  }

  async count(conditions: {
    id?: string;
    productId?: string;
    episodeNumber?: number;
    title?: string;
    subTitle?: string;
  }) {
    return this.entityManager.count(this.entityClass, {
      where: stripUndefined<Episode>({
        id: conditions.id,
        productId: conditions.productId,
        episodeNumber: conditions.episodeNumber,
        title: conditions.title,
        subTitle: conditions.subTitle,
      }),
    });
  }
}
