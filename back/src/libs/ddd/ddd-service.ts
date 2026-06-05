import { Inject, Optional } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import type { EntityManager } from "typeorm";
import { Context } from "../../common/context";

export abstract class DddService {
  @Optional()
  @InjectEntityManager()
  entityManager?: EntityManager;

  @Optional()
  @Inject()
  context?: Context;
}
