import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveTypeOrmOptions } from './databases.module';

describe('resolveTypeOrmOptions', () => {
    it('preserves database synchronize and logging options from configuration', () => {
        const options = resolveTypeOrmOptions({
            database: {
                type: 'mysql',
                host: '127.0.0.1',
                port: 3306,
                username: 'test',
                password: '',
                database: 'echocast',
                synchronize: false,
                logging: true,
            },
        });

        assert.equal(options.synchronize, false);
        assert.equal(options.logging, true);
        assert.ok(Array.isArray(options.entities));
    });
});
