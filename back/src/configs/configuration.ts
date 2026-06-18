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

function readEnv(env: Record<string, string | undefined>, key: string, legacyKey?: string): string | undefined {
    return env[key] ?? (legacyKey ? env[legacyKey] : undefined);
}

function parseNumberEnv(env: Record<string, string | undefined>, key: string, defaultValue: number, legacyKey?: string): number {
    const value = Number(readEnv(env, key, legacyKey) ?? defaultValue);
    if (!Number.isFinite(value)) {
        throw new Error(`${key} 설정 값이 올바른 숫자가 아닙니다.`);
    }
    return value;
}

function requireEnv(env: Record<string, string | undefined>, key: string, legacyKey?: string): string {
    const value = readEnv(env, key, legacyKey);
    if (value === undefined || value === '') {
        throw new Error(`${key} 설정 값이 필요합니다.`);
    }
    return value;
}

function resolveDatabaseConfig(env: Record<string, string | undefined>): DataSourceOptions {
    const isProduction = env.NODE_ENV === 'production';
    const synchronize = !isProduction;

    return {
        type: 'mariadb',
        host: readEnv(env, 'NEW_DUBRIGHT_DB_HOST', 'TEST_PLAYER_DB_HOST') ?? '127.0.0.1',
        port: parseNumberEnv(env, 'NEW_DUBRIGHT_DB_PORT', 3306, 'TEST_PLAYER_DB_PORT'),
        username: requireEnv(env, 'NEW_DUBRIGHT_DB_USERNAME', 'TEST_PLAYER_DB_USERNAME'),
        password: readEnv(env, 'NEW_DUBRIGHT_DB_PASSWORD', 'TEST_PLAYER_DB_PASSWORD') ?? '',
        database: requireEnv(env, 'NEW_DUBRIGHT_DB_DATABASE', 'TEST_PLAYER_DB_DATABASE'),
        synchronize,
        logging: false,
    };
}

function resolveAwsConfig(env: Record<string, string | undefined>): AwsConfig | undefined {
    const hasAwsConfig = [
        readEnv(env, 'NEW_DUBRIGHT_AWS_BUCKET_NAME', 'TEST_PLAYER_AWS_BUCKET_NAME'),
        readEnv(env, 'NEW_DUBRIGHT_AWS_REGION', 'TEST_PLAYER_AWS_REGION'),
        readEnv(env, 'NEW_DUBRIGHT_AWS_URL', 'TEST_PLAYER_AWS_URL'),
        readEnv(env, 'NEW_DUBRIGHT_AWS_ACCESS_KEY_ID', 'TEST_PLAYER_AWS_ACCESS_KEY_ID'),
        readEnv(env, 'NEW_DUBRIGHT_AWS_SECRET_ACCESS_KEY', 'TEST_PLAYER_AWS_SECRET_ACCESS_KEY'),
    ].some((value) => value !== undefined && value !== '');

    if (!hasAwsConfig) {
        return undefined;
    }

    const accessKeyId = readEnv(env, 'NEW_DUBRIGHT_AWS_ACCESS_KEY_ID', 'TEST_PLAYER_AWS_ACCESS_KEY_ID');
    const secretAccessKey = readEnv(env, 'NEW_DUBRIGHT_AWS_SECRET_ACCESS_KEY', 'TEST_PLAYER_AWS_SECRET_ACCESS_KEY');
    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
        throw new Error('NEW_DUBRIGHT_AWS_ACCESS_KEY_ID와 NEW_DUBRIGHT_AWS_SECRET_ACCESS_KEY는 함께 설정해야 합니다.');
    }

    return {
        bucketName: requireEnv(env, 'NEW_DUBRIGHT_AWS_BUCKET_NAME', 'TEST_PLAYER_AWS_BUCKET_NAME'),
        region: requireEnv(env, 'NEW_DUBRIGHT_AWS_REGION', 'TEST_PLAYER_AWS_REGION'),
        awsUrl: requireEnv(env, 'NEW_DUBRIGHT_AWS_URL', 'TEST_PLAYER_AWS_URL'),
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
