import type { DataSourceOptions } from 'typeorm';

export interface ServerConfig {
    port: number;
}

export interface AwsConfig {
    bucketName: string;
    region: string;
    awsUrl: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

export interface AppConfig {
    server: ServerConfig;
    database: DataSourceOptions;
    aws?: AwsConfig;
}

type DatabaseMode = 'memory' | 'file' | 'mysql' | 'mariadb';

function resolveDatabaseMode(env: Record<string, string | undefined>): DatabaseMode {
    const mode = env.TEST_PLAYER_DATABASE_MODE;
    if (mode === 'file' || mode === 'mysql' || mode === 'mariadb') {
        return mode;
    }
    return 'memory';
}

function parseNumberEnv(env: Record<string, string | undefined>, key: string, defaultValue: number): number {
    const value = Number(env[key] ?? defaultValue);
    if (!Number.isFinite(value)) {
        throw new Error(`${key} 설정 값이 올바른 숫자가 아닙니다.`);
    }
    return value;
}

function parseBooleanEnv(env: Record<string, string | undefined>, key: string, defaultValue: boolean): boolean {
    const value = env[key];
    if (value === undefined) {
        return defaultValue;
    }
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    throw new Error(`${key} 설정 값은 true 또는 false여야 합니다.`);
}

function requireEnv(env: Record<string, string | undefined>, key: string): string {
    const value = env[key];
    if (value === undefined || value === '') {
        throw new Error(`${key} 설정 값이 필요합니다.`);
    }
    return value;
}

function resolveDatabaseConfig(env: Record<string, string | undefined>): DataSourceOptions {
    const mode = resolveDatabaseMode(env);
    const isProduction = env.NODE_ENV === 'production';

    if (mode === 'mysql' || mode === 'mariadb') {
        return {
            type: mode,
            host: env.TEST_PLAYER_DB_HOST ?? '127.0.0.1',
            port: parseNumberEnv(env, 'TEST_PLAYER_DB_PORT', 3306),
            username: requireEnv(env, 'TEST_PLAYER_DB_USERNAME'),
            password: env.TEST_PLAYER_DB_PASSWORD ?? '',
            database: requireEnv(env, 'TEST_PLAYER_DB_DATABASE'),
            synchronize: isProduction ? false : parseBooleanEnv(env, 'TEST_PLAYER_DB_SYNCHRONIZE', false),
            logging: parseBooleanEnv(env, 'TEST_PLAYER_DB_LOGGING', false),
        };
    }

    return {
        type: 'sqljs',
        location: mode === 'file' ? (env.TEST_PLAYER_DB_PATH ?? 'test-player.sqlite') : undefined,
        autoSave: mode === 'file',
        synchronize: isProduction ? false : true,
        logging: false,
    };
}

function resolveAwsConfig(env: Record<string, string | undefined>): AwsConfig | undefined {
    const hasAwsConfig = [
        env.TEST_PLAYER_AWS_BUCKET_NAME,
        env.TEST_PLAYER_AWS_REGION,
        env.TEST_PLAYER_AWS_URL,
        env.TEST_PLAYER_AWS_ACCESS_KEY_ID,
        env.TEST_PLAYER_AWS_SECRET_ACCESS_KEY,
    ].some((value) => value !== undefined && value !== '');

    if (!hasAwsConfig) {
        return undefined;
    }

    const accessKeyId = env.TEST_PLAYER_AWS_ACCESS_KEY_ID;
    const secretAccessKey = env.TEST_PLAYER_AWS_SECRET_ACCESS_KEY;
    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
        throw new Error('TEST_PLAYER_AWS_ACCESS_KEY_ID와 TEST_PLAYER_AWS_SECRET_ACCESS_KEY는 함께 설정해야 합니다.');
    }

    return {
        bucketName: requireEnv(env, 'TEST_PLAYER_AWS_BUCKET_NAME'),
        region: requireEnv(env, 'TEST_PLAYER_AWS_REGION'),
        awsUrl: requireEnv(env, 'TEST_PLAYER_AWS_URL'),
        accessKeyId,
        secretAccessKey,
    };
}

export default function configuration(env: Record<string, string | undefined> = process.env): AppConfig {
    return {
        server: {
            port: parseNumberEnv(env, 'PORT', 4100),
        },
        database: resolveDatabaseConfig(env),
        aws: resolveAwsConfig(env),
    };
}
