import { Injectable } from "@nestjs/common";
import { DddRepository } from "../../../libs/ddd";
import { stripUndefined } from "../../../libs/utils/helper";
import type { FindManyOptions } from "typeorm";
import { Media, type MediaType } from "../domain/media.entity";

@Injectable()
export class MediaRepository extends DddRepository<Media> {
  entityClass = Media;

  async find(
    conditions: {
      id?: number;
      mediaType?: MediaType;
      mediaUrl?: string;
      startTime?: number;
      endTime?: number;
    },
    options?: Omit<FindManyOptions<Media>, "where">,
  ) {
    return this.entityManager.find(this.entityClass, {
      where: stripUndefined<Media>({
        id: conditions.id,
        mediaType: conditions.mediaType,
        mediaUrl: conditions.mediaUrl,
        startTime: conditions.startTime,
        endTime: conditions.endTime,
      }),
      ...options,
    });
  }

  async count(conditions: {
    id?: number;
    mediaType?: MediaType;
    mediaUrl?: string;
    startTime?: number;
    endTime?: number;
  }) {
    return this.entityManager.count(this.entityClass, {
      where: stripUndefined<Media>({
        id: conditions.id,
        mediaType: conditions.mediaType,
        mediaUrl: conditions.mediaUrl,
        startTime: conditions.startTime,
        endTime: conditions.endTime,
      }),
    });
  }
}
