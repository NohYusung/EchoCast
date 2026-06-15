const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
    getDesktopConfig,
    getDesktopServiceDefinitions,
    startManagedProcesses,
    stopManagedProcesses,
    waitForHttp,
} = require('./services.cjs');

test('getDesktopConfig builds local front and back URLs from environment ports', () => {
    const config = getDesktopConfig({
        TEST_PLAYER_DESKTOP_FRONT_PORT: '3107',
        TEST_PLAYER_DESKTOP_BACK_PORT: '4107',
    });

    assert.equal(config.frontPort, 3107);
    assert.equal(config.backPort, 4107);
    assert.equal(config.frontUrl, 'http://localhost:3107');
    assert.equal(config.apiBaseUrl, 'http://localhost:4107');
    assert.equal(config.apiReadyUrl, 'http://localhost:4107/products');
});

test('getDesktopServiceDefinitions wires back and front workspace commands', () => {
    const config = getDesktopConfig({});
    const services = getDesktopServiceDefinitions(config);

    assert.deepEqual(
        services.map((service) => [service.name, service.command, service.args]),
        [
            ['back', 'npm', ['run', 'start:dev', '--workspace', '@test-player/back']],
            ['front', 'npm', ['run', 'dev', '--workspace', '@test-player/front', '--', '-p', '3000']],
        ],
    );
    assert.equal(services[0].env.PORT, '4100');
    assert.equal(services[1].env.NEXT_PUBLIC_API_BASE_URL, 'http://localhost:4100');
});

test('startManagedProcesses spawns each service and stopManagedProcesses kills active children', () => {
    const spawned = [];
    const killed = [];
    const fakeSpawn = (command, args, options) => {
        const child = {
            killed: false,
            kill: (signal) => {
                child.killed = true;
                killed.push(signal);
            },
            on: () => child,
        };
        spawned.push({ command, args, options, child });
        return child;
    };

    const children = startManagedProcesses(getDesktopConfig({}), { spawn: fakeSpawn });
    stopManagedProcesses(children);

    assert.equal(spawned.length, 2);
    assert.equal(spawned[0].options.stdio, 'inherit');
    assert.equal(spawned[1].options.env.NEXT_PUBLIC_API_BASE_URL, 'http://localhost:4100');
    assert.deepEqual(killed, ['SIGTERM', 'SIGTERM']);
});

test('waitForHttp retries until a request succeeds', async () => {
    let attempts = 0;
    const result = await waitForHttp('http://127.0.0.1:3000', {
        attempts: 3,
        fetch: async () => {
            attempts += 1;
            return { ok: attempts === 3 };
        },
        intervalMs: 0,
        setTimeout: (callback) => {
            callback();
            return 0;
        },
    });

    assert.equal(result, true);
    assert.equal(attempts, 3);
});
