import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DddAggregate } from './ddd-aggregate';

class TestAggregate extends DddAggregate {
    title = 'same title';
    count = 1;

    strip(args: { title?: string; count?: number }) {
        return this.stripUnchanged(args);
    }
}

describe('DddAggregate', () => {
    it('returns undefined when stripUnchanged receives no changed fields', () => {
        const aggregate = new TestAggregate();

        assert.equal(aggregate.strip({ title: 'same title', count: 1 }), undefined);
    });

    it('returns only changed fields from stripUnchanged', () => {
        const aggregate = new TestAggregate();

        assert.deepEqual(aggregate.strip({ title: 'next title', count: 1 }), { title: 'next title' });
    });
});
