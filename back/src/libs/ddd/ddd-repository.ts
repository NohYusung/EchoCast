import { Optional } from '@nestjs/common';
import { DataSource, EntityManager, ObjectType } from 'typeorm';
import { DddAggregate } from './ddd-aggregate';
import { InjectDataSource } from '@nestjs/typeorm';
import { Context, ContextKey } from '../../common/context';
import { DddEvent } from './ddd-event';

export abstract class DddRepository<T extends DddAggregate> {
    constructor(
        @Optional()
        @InjectDataSource()
        private readonly datasource?: DataSource,
        @Optional()
        private readonly context?: Context
    ) {}

    abstract entityClass: ObjectType<T>;

    get entityManager(): EntityManager {
        // NOTE: Context의 entityManager를 꺼내오는 경우는, @Transaction()으로 인한 Transaction entityManager를 가져오기 위함.
        const entityManager = this.context?.get<EntityManager>(ContextKey.ENTITY_MANAGER);
        if (entityManager) return entityManager;

        if (!this.datasource) {
            throw new Error(`${this.constructor.name} requires a TypeORM DataSource.`);
        }

        return this.datasource.manager;
    }

    createQueryBuilder(alias: string) {
        return this.entityManager.createQueryBuilder<T>(this.entityClass, alias);
    }

    async save(entities: T[]) {
        await this.saveEntities(entities);
        await this.saveEvents(entities.flatMap((entity) => entity.getPublishedEvents()));
    }

    async softRemove(entities: T[]) {
        await this.entityManager.softRemove(entities);
    }

    private async saveEntities(entities: T[]) {
        const traceId = this.context?.get<string>(ContextKey.TRACE_ID);
        if (traceId) {
            entities.forEach((entity) => entity.setTraceId(traceId));
        }
        await this.entityManager.save(entities);
    }

    private async saveEvents(events: DddEvent[]) {
        if (events.length === 0) return;

        const traceId = this.context?.get<string>(ContextKey.TRACE_ID);
        const dddEvents = events.map((event) => DddEvent.fromEvent(event));
        if (traceId) {
            dddEvents.forEach((event) => event.setTraceId(traceId));
        }

        await this.entityManager.save(dddEvents);

        if (!this.context) return;

        // NOTE: 하나의 트랜잭션안에서 모든 DddEvent를 저장하기 위해, 이전 DddEvent와 현재 DddEvent를 합쳐서 컨텍스트에 저장.
        const currentDddEvents = this.context.get<DddEvent[]>(ContextKey.DDD_EVENTS) || [];
        currentDddEvents.push(...dddEvents);

        // NOTE: DDD 이벤트를 저장한 후, DDD 이벤트를 컨텍스트에 저장하여 이벤트 발행 시 사용.
        this.context.set(ContextKey.DDD_EVENTS, currentDddEvents);
    }
}
