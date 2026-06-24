const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
    getDesktopConfig,
    getDesktopServiceDefinitions,
    getPackagedNextServerEntry,
    startManagedProcesses,
    stopManagedProcesses,
    waitForHttp,
} = require('./services.cjs');

test('getDesktopConfig builds local front and back URLs from environment ports', () => {
    const config = getDesktopConfig({
        NEW_DUBRIGHT_DESKTOP_FRONT_PORT: '3107',
        NEW_DUBRIGHT_DESKTOP_BACK_PORT: '4107',
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
            ['back', 'npm', ['run', 'start:dev', '--workspace', '@new-dubright/back']],
            ['front', 'npm', ['run', 'dev', '--workspace', '@new-dubright/front', '--', '-p', '3000']],
        ],
    );
    assert.equal(services[0].env.PORT, '4100');
    assert.equal(services[1].env.NEXT_PUBLIC_API_BASE_URL, 'http://localhost:4100');
});

test('getDesktopServiceDefinitions uses the packaged Next server without starting the backend', () => {
    const config = getDesktopConfig(
        {
            NEW_DUBRIGHT_API_BASE_URL: 'https://api.example.com',
            NEW_DUBRIGHT_DESKTOP_FRONT_PORT: '3200',
            NEW_DUBRIGHT_DESKTOP_PACKAGED: 'true',
        },
        {
            execPath: '/Applications/new-dubright.app/Contents/MacOS/new-dubright',
            resourcesPath: '/Applications/new-dubright.app/Contents/Resources',
        },
    );
    const services = getDesktopServiceDefinitions(config);

    assert.equal(config.isPackaged, true);
    assert.equal(config.apiBaseUrl, 'https://api.example.com');
    assert.equal(config.frontStandaloneDir, '/Applications/new-dubright.app/Contents/Resources/front-standalone');
    assert.deepEqual(
        services.map((service) => [service.name, service.command]),
        [['front', '/Applications/new-dubright.app/Contents/MacOS/new-dubright']],
    );
    assert.deepEqual(services[0].args, ['/Applications/new-dubright.app/Contents/Resources/front-standalone/front/server.js']);
    assert.equal(services[0].cwd, '/Applications/new-dubright.app/Contents/Resources/front-standalone/front');
    assert.equal(services[0].env.ELECTRON_RUN_AS_NODE, '1');
    assert.equal(services[0].env.NEXT_PUBLIC_API_BASE_URL, 'https://api.example.com');
    assert.equal(services[0].env.PORT, '3200');
});

test('getPackagedNextServerEntry supports a root standalone server fallback', () => {
    const serverEntry = getPackagedNextServerEntry('/tmp/new-dubright-missing-standalone');

    assert.equal(serverEntry, '/tmp/new-dubright-missing-standalone/front/server.js');
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
