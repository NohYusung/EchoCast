import { Injectable } from "@nestjs/common";
import { DddRepository } from "../../../libs/ddd";
import { stripUndefined } from "../../../libs/utils/helper";
import type { TrackKind } from "../../player/domain/player-contract.types";
import type { FindManyOptions } from "typeorm";
import { Track } from "../domain/track.entity";

@Injectable()
export class TrackRepository extends DddRepository<Track> {
  entityClass = Track;

  async find(
    conditions: {
      id?: string;
      episodeId?: string;
      name?: string;
      kind?: TrackKind;
      layerId?: number;
      isMuted?: boolean;
    },
    options?: Omit<FindManyOptions<Track>, "where">,
  ) {
    return this.entityManager.find(this.entityClass, {
      where: stripUndefined<Track>({
        id: conditions.id,
        episodeId: conditions.episodeId,
        name: conditions.name,
        kind: conditions.kind,
        layerId: conditions.layerId,
        isMuted: conditions.isMuted,
      }),
      ...options,
    });
  }

  async count(conditions: {
    id?: string;
    episodeId?: string;
    name?: string;
    kind?: TrackKind;
    layerId?: number;
    isMuted?: boolean;
  }) {
    return this.entityManager.count(this.entityClass, {
      where: stripUndefined<Track>({
        id: conditions.id,
        episodeId: conditions.episodeId,
        name: conditions.name,
        kind: conditions.kind,
        layerId: conditions.layerId,
        isMuted: conditions.isMuted,
      }),
    });
  }
}
