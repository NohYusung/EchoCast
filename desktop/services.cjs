const path = require('node:path');
const fs = require('node:fs');
const { spawn: nodeSpawn } = require('node:child_process');

const DEFAULT_FRONT_PORT = 3000;
const DEFAULT_BACK_PORT = 4100;
const DEFAULT_HOST = 'localhost';
const PACKAGED_FRONT_RESOURCE_DIR = 'front-standalone';

function parsePort(value, fallback) {
    const parsed = Number.parseInt(value ?? '', 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeLaunchPath(value) {
    if (!value) {
        return '/';
    }

    return value.startsWith('/') ? value : `/${value}`;
}

function getDesktopConfig(env = process.env, runtime = {}) {
    const frontPort = parsePort(env.NEW_DUBRIGHT_DESKTOP_FRONT_PORT ?? env.TEST_PLAYER_DESKTOP_FRONT_PORT, DEFAULT_FRONT_PORT);
    const backPort = parsePort(env.NEW_DUBRIGHT_DESKTOP_BACK_PORT ?? env.TEST_PLAYER_DESKTOP_BACK_PORT, DEFAULT_BACK_PORT);
    const host = env.NEW_DUBRIGHT_DESKTOP_HOST || env.TEST_PLAYER_DESKTOP_HOST || DEFAULT_HOST;
    const frontUrl = `http://${host}:${frontPort}`;
    const isPackaged =
        typeof runtime.isPackaged === 'boolean'
            ? runtime.isPackaged
            : env.NEW_DUBRIGHT_DESKTOP_PACKAGED === 'true' || env.NEW_DUBRIGHT_DESKTOP_MODE === 'packaged';
    const localApiBaseUrl = `http://${host}:${backPort}`;
    const apiBaseUrl = isPackaged
        ? env.NEW_DUBRIGHT_API_BASE_URL || env.NEXT_PUBLIC_API_BASE_URL || localApiBaseUrl
        : localApiBaseUrl;
    const launchPath = normalizeLaunchPath(env.NEW_DUBRIGHT_DESKTOP_PATH ?? env.TEST_PLAYER_DESKTOP_PATH);
    const resourcesPath = runtime.resourcesPath || process.resourcesPath || path.resolve(__dirname, '..');
    const frontStandaloneDir =
        env.NEW_DUBRIGHT_DESKTOP_STANDALONE_DIR || path.join(resourcesPath, PACKAGED_FRONT_RESOURCE_DIR);

    return {
        apiReadyUrl: new URL('/products', apiBaseUrl).toString(),
        apiBaseUrl,
        backPort,
        electronExecPath: runtime.execPath || process.execPath,
        frontPort,
        frontStandaloneDir,
        frontUrl,
        host,
        isPackaged,
        launchPath,
        launchUrl: new URL(launchPath, frontUrl).toString(),
        rootDir: path.resolve(__dirname, '..'),
    };
}

function getDesktopServiceDefinitions(config) {
    if (config.isPackaged) {
        const serverEntry = getPackagedNextServerEntry(config.frontStandaloneDir);

        return [
            {
                name: 'front',
                command: config.electronExecPath,
                args: [serverEntry],
                cwd: path.dirname(serverEntry),
                env: {
                    ELECTRON_RUN_AS_NODE: '1',
                    HOSTNAME: config.host,
                    NEXT_PUBLIC_API_BASE_URL: config.apiBaseUrl,
                    NODE_ENV: 'production',
                    PORT: String(config.frontPort),
                },
            },
        ];
    }

    return [
        {
            name: 'back',
            command: 'npm',
            args: ['run', 'start:dev', '--workspace', '@new-dubright/back'],
            cwd: config.rootDir,
            env: {
                PORT: String(config.backPort),
            },
        },
        {
            name: 'front',
            command: 'npm',
            args: ['run', 'dev', '--workspace', '@new-dubright/front', '--', '-p', String(config.frontPort)],
            cwd: config.rootDir,
            env: {
                NEXT_PUBLIC_API_BASE_URL: config.apiBaseUrl,
            },
        },
    ];
}

function startManagedProcesses(config, dependencies = {}) {
    const spawn = dependencies.spawn ?? nodeSpawn;

    return getDesktopServiceDefinitions(config).map((service) => {
        const child = spawn(service.command, service.args, {
            cwd: service.cwd,
            env: {
                ...process.env,
                ...service.env,
            },
            stdio: 'inherit',
        });

        child.on?.('exit', (code, signal) => {
            if (code === 0 || signal) {
                return;
            }

            console.error(`[desktop] ${service.name} process exited with code ${code}`);
        });

        child.on?.('error', (error) => {
            console.error(`[desktop] failed to start ${service.name}: ${error.message}`);
        });

        return child;
    });
}

function stopManagedProcesses(children) {
    for (const child of children) {
        if (!child || child.killed) {
            continue;
        }

        child.kill('SIGTERM');
    }
}

function getPackagedNextServerEntry(frontStandaloneDir) {
    const candidates = [
        path.join(frontStandaloneDir, 'front', 'server.js'),
        path.join(frontStandaloneDir, 'server.js'),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

async function waitForHttp(url, options = {}) {
    const attempts = options.attempts ?? 120;
    const fetchImpl = options.fetch ?? fetch;
    const intervalMs = options.intervalMs ?? 500;
    const setTimeoutImpl = options.setTimeout ?? setTimeout;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const response = await fetchImpl(url);

            if (response.ok) {
                return true;
            }
        } catch {
            // The service is still booting.
        }

        await new Promise((resolve) => setTimeoutImpl(resolve, intervalMs));
    }

    return false;
}

module.exports = {
    getDesktopConfig,
    getDesktopServiceDefinitions,
    getPackagedNextServerEntry,
    startManagedProcesses,
    stopManagedProcesses,
    waitForHttp,
};
