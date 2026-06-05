import { Injectable } from "@nestjs/common";
import { DddRepository } from "../../../libs/ddd";
import { stripUndefined } from "../../../libs/utils/helper";
import type { FindManyOptions } from "typeorm";
import { Script } from "../domain/script.entity";

@Injectable()
export class ScriptRepository extends DddRepository<Script> {
  entityClass = Script;

  async find(
    conditions: {
      id?: string;
      script?: string;
      characterId?: string;
    },
    options?: Omit<FindManyOptions<Script>, "where">,
  ) {
    return this.entityManager.find(this.entityClass, {
      where: stripUndefined<Script>({
        id: conditions.id,
        script: conditions.script,
        characterId: conditions.characterId,
      }),
      ...options,
    });
  }

  async count(conditions: {
    id?: string;
    script?: string;
    characterId?: string;
  }) {
    return this.entityManager.count(this.entityClass, {
      where: stripUndefined<Script>({
        id: conditions.id,
        script: conditions.script,
        characterId: conditions.characterId,
      }),
    });
  }
}
