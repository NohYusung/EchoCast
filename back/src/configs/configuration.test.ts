import assert from 'node:assert/strict';
import { test } from 'node:test';
import configuration from './configuration';

test('database synchronize is fixed by NODE_ENV instead of env flags', () => {
    const localConfig = configuration({
        NODE_ENV: 'local',
        ECHOCAST_DB_USERNAME: 'echocast',
        ECHOCAST_DB_DATABASE: 'echocast',
        ECHOCAST_DB_SYNCHRONIZE: 'false',
        ECHOCAST_DB_LOGGING: 'true',
    });
    const productionConfig = configuration({
        NODE_ENV: 'production',
        ECHOCAST_DB_USERNAME: 'echocast',
        ECHOCAST_DB_DATABASE: 'echocast',
        ECHOCAST_DB_SYNCHRONIZE: 'true',
        ECHOCAST_DB_LOGGING: 'true',
    });

    assert.equal(localConfig.database.type, 'mariadb');
    assert.equal(localConfig.database.synchronize, true);
    assert.equal(localConfig.database.logging, false);
    assert.equal(productionConfig.database.type, 'mariadb');
    assert.equal(productionConfig.database.synchronize, false);
    assert.equal(productionConfig.database.logging, false);
});

test('test environment uses an in-memory database without DB env values', () => {
    const testConfig = configuration({
        NODE_ENV: 'test',
    });

    assert.equal(testConfig.database.type, 'sqljs');
    assert.equal(testConfig.database.synchronize, true);
    assert.equal(testConfig.database.logging, false);
});

test('database config accepts legacy new-dubright env keys', () => {
    const config = configuration({
        NODE_ENV: 'local',
        NEW_DUBRIGHT_DB_USERNAME: 'legacy_user',
        NEW_DUBRIGHT_DB_DATABASE: 'legacy_database',
    });

    assert.equal(config.database.type, 'mariadb');
    assert.equal(config.database.username, 'legacy_user');
    assert.equal(config.database.database, 'legacy_database');
});
