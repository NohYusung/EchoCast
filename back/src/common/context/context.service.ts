import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export enum ContextKey {
    ENTITY_MANAGER = 'entityManager',
    DDD_EVENTS = 'dddEvents',
    TRACE_ID = 'traceId',
}

export const asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

@Injectable()
export class Context {
    getStore() {
        return asyncLocalStorage.getStore();
    }

    set<T extends ContextKey>(key: T, value: any) {
        const store = this.getStore();

        if (store) {
            store.set(key, value);
        } else {
            throw new Error('There is no context store.');
        }
    }

    get<K>(key: ContextKey): K {
        return this.getStore()?.get(key);
    }
}
