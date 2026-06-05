import { Injectable } from "@nestjs/common";

export enum ContextKey {
  ENTITY_MANAGER = "ENTITY_MANAGER",
  TRACE_ID = "TRACE_ID",
  DDD_EVENTS = "DDD_EVENTS",
}

@Injectable()
export class Context {
  private readonly values = new Map<ContextKey, unknown>();

  get<T>(key: ContextKey): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  set<T>(key: ContextKey, value: T) {
    this.values.set(key, value);
  }
}
