import { Injectable } from "@nestjs/common";
import { DddRepository } from "../../../libs/ddd";
import { stripUndefined } from "../../../libs/utils/helper";
import type { FindManyOptions } from "typeorm";
import { Character, type CharacterRole } from "../domain/character.entity";

@Injectable()
export class CharacterRepository extends DddRepository<Character> {
  entityClass = Character;

  async find(
    conditions: {
      id?: string;
      productId?: string;
      name?: string;
      role?: CharacterRole;
    },
    options?: Omit<FindManyOptions<Character>, "where">,
  ) {
    return this.entityManager.find(this.entityClass, {
      where: stripUndefined<Character>({
        id: conditions.id,
        productId: conditions.productId,
        name: conditions.name,
        role: conditions.role,
      }),
      ...options,
    });
  }

  async count(conditions: {
    id?: string;
    productId?: string;
    name?: string;
    role?: CharacterRole;
  }) {
    return this.entityManager.count(this.entityClass, {
      where: stripUndefined<Character>({
        id: conditions.id,
        productId: conditions.productId,
        name: conditions.name,
        role: conditions.role,
      }),
    });
  }
}
