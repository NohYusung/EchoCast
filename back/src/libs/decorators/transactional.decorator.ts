import { InternalServerErrorException } from '@nestjs/common';
import { asyncLocalStorage, ContextKey } from '../../common/context';
import type { DddEvent, DddService } from '../ddd';

type TransactionalService = DddService & {
    eventEmitter?: {
        emit(eventName: string, event: DddEvent): void;
    };
};

export function Transactional() {
    return function (target: DddService, propertyKey: string, descriptor: PropertyDescriptor) {
        // NOTE: 적용된 메서드의 function
        const originalMethod = descriptor.value;

        descriptor.value = async function (this: TransactionalService, ...args: any[]) {
            const runTransaction = async () => {
                let result: any;

                const context = this.context;
                const entityManager = this.entityManager;
                const eventEmitter = this.eventEmitter;

                if (!context || !entityManager) {
                    throw new InternalServerErrorException(
                        '트랜잭션 실행에 필요한 Context 또는 EntityManager가 없습니다.'
                    );
                }

                //  NOTE: 해당 방식은 무조건 transaction() 메서드가 제공하는 entityManager를 사용하여야한다. https://typeorm.io/docs/advanced-topics/transactions
                await entityManager.transaction(async (transactionEntityManager) => {
                    context.set(ContextKey.ENTITY_MANAGER, transactionEntityManager);
                    try {
                        result = await originalMethod.apply(this, args);
                    } finally {
                        context.set(ContextKey.ENTITY_MANAGER, null);
                    }
                });

                // NOTE: DDD 이벤트를 꺼내서 Redis Queue로 넣어주기 위한 작업.
                const dddEvents = context.get<DddEvent[]>(ContextKey.DDD_EVENTS);
                if (eventEmitter && dddEvents && dddEvents.length > 0) {
                    dddEvents.forEach((dddEvent) => {
                        eventEmitter.emit('ddd-event.created', dddEvent);
                    });
                }
                context.set(ContextKey.DDD_EVENTS, []);

                return result;
            };

            if (this.context?.getStore()) {
                return runTransaction();
            }

            return asyncLocalStorage.run(new Map(), runTransaction);
        };
        return descriptor;
    };
}
