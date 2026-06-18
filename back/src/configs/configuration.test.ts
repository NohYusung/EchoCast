import assert from 'node:assert/strict';
import { test } from 'node:test';
import configuration from './configuration';

test('database synchronize is fixed by NODE_ENV instead of env flags', () => {
    const localConfig = configuration({
        NODE_ENV: 'local',
        NEW_DUBRIGHT_DB_USERNAME: 'new_dubright',
        NEW_DUBRIGHT_DB_DATABASE: 'new_dubright',
        NEW_DUBRIGHT_DB_SYNCHRONIZE: 'false',
        NEW_DUBRIGHT_DB_LOGGING: 'true',
    });
    const productionConfig = configuration({
        NODE_ENV: 'production',
        NEW_DUBRIGHT_DB_USERNAME: 'new_dubright',
        NEW_DUBRIGHT_DB_DATABASE: 'new_dubright',
        NEW_DUBRIGHT_DB_SYNCHRONIZE: 'true',
        NEW_DUBRIGHT_DB_LOGGING: 'true',
    });

    assert.equal(localConfig.database.type, 'mariadb');
    assert.equal(localConfig.database.synchronize, true);
    assert.equal(localConfig.database.logging, false);
    assert.equal(productionConfig.database.type, 'mariadb');
    assert.equal(productionConfig.database.synchronize, false);
    assert.equal(productionConfig.database.logging, false);
});
