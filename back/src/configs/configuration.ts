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

function readEnv(env: Record<string, string | undefined>, key: string, ...legacyKeys: string[]): string | undefined {
    for (const candidateKey of [key, ...legacyKeys]) {
        const value = env[candidateKey];
        if (value !== undefined) {
            return value;
        }
    }

    return undefined;
}

function parseNumberEnv(
    env: Record<string, string | undefined>,
    key: string,
    defaultValue: number,
    ...legacyKeys: string[]
): number {
    const value = Number(readEnv(env, key, ...legacyKeys) ?? defaultValue);
    if (!Number.isFinite(value)) {
        throw new Error(`${key} 설정 값이 올바른 숫자가 아닙니다.`);
    }
    return value;
}

function requireEnv(env: Record<string, string | undefined>, key: string, ...legacyKeys: string[]): string {
    const value = readEnv(env, key, ...legacyKeys);
    if (value === undefined || value === '') {
        throw new Error(`${key} 설정 값이 필요합니다.`);
    }
    return value;
}

function resolveDatabaseConfig(env: Record<string, string | undefined>): DataSourceOptions {
    const isProduction = env.NODE_ENV === 'production';
    const isTest = env.NODE_ENV === 'test';

    if (isTest) {
        return {
            type: 'sqljs',
            synchronize: true,
            logging: false,
            autoSave: false,
        };
    }

    const synchronize = !isProduction;

    return {
        type: 'mariadb',
        host: readEnv(env, 'ECHOCAST_DB_HOST', 'NEW_DUBRIGHT_DB_HOST', 'TEST_PLAYER_DB_HOST') ?? '127.0.0.1',
        port: parseNumberEnv(env, 'ECHOCAST_DB_PORT', 3306, 'NEW_DUBRIGHT_DB_PORT', 'TEST_PLAYER_DB_PORT'),
        username: requireEnv(env, 'ECHOCAST_DB_USERNAME', 'NEW_DUBRIGHT_DB_USERNAME', 'TEST_PLAYER_DB_USERNAME'),
        password: readEnv(env, 'ECHOCAST_DB_PASSWORD', 'NEW_DUBRIGHT_DB_PASSWORD', 'TEST_PLAYER_DB_PASSWORD') ?? '',
        database: requireEnv(env, 'ECHOCAST_DB_DATABASE', 'NEW_DUBRIGHT_DB_DATABASE', 'TEST_PLAYER_DB_DATABASE'),
        synchronize,
        logging: false,
    };
}

function resolveAwsConfig(env: Record<string, string | undefined>): AwsConfig | undefined {
    const hasAwsConfig = [
        readEnv(env, 'ECHOCAST_AWS_BUCKET_NAME', 'NEW_DUBRIGHT_AWS_BUCKET_NAME', 'TEST_PLAYER_AWS_BUCKET_NAME'),
        readEnv(env, 'ECHOCAST_AWS_REGION', 'NEW_DUBRIGHT_AWS_REGION', 'TEST_PLAYER_AWS_REGION'),
        readEnv(env, 'ECHOCAST_AWS_URL', 'NEW_DUBRIGHT_AWS_URL', 'TEST_PLAYER_AWS_URL'),
        readEnv(env, 'ECHOCAST_AWS_ACCESS_KEY_ID', 'NEW_DUBRIGHT_AWS_ACCESS_KEY_ID', 'TEST_PLAYER_AWS_ACCESS_KEY_ID'),
        readEnv(
            env,
            'ECHOCAST_AWS_SECRET_ACCESS_KEY',
            'NEW_DUBRIGHT_AWS_SECRET_ACCESS_KEY',
            'TEST_PLAYER_AWS_SECRET_ACCESS_KEY',
        ),
    ].some((value) => value !== undefined && value !== '');

    if (!hasAwsConfig) {
        return undefined;
    }

    const accessKeyId = readEnv(
        env,
        'ECHOCAST_AWS_ACCESS_KEY_ID',
        'NEW_DUBRIGHT_AWS_ACCESS_KEY_ID',
        'TEST_PLAYER_AWS_ACCESS_KEY_ID',
    );
    const secretAccessKey = readEnv(
        env,
        'ECHOCAST_AWS_SECRET_ACCESS_KEY',
        'NEW_DUBRIGHT_AWS_SECRET_ACCESS_KEY',
        'TEST_PLAYER_AWS_SECRET_ACCESS_KEY',
    );
    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
        throw new Error('ECHOCAST_AWS_ACCESS_KEY_ID와 ECHOCAST_AWS_SECRET_ACCESS_KEY는 함께 설정해야 합니다.');
    }

    return {
        bucketName: requireEnv(
            env,
            'ECHOCAST_AWS_BUCKET_NAME',
            'NEW_DUBRIGHT_AWS_BUCKET_NAME',
            'TEST_PLAYER_AWS_BUCKET_NAME',
        ),
        region: requireEnv(env, 'ECHOCAST_AWS_REGION', 'NEW_DUBRIGHT_AWS_REGION', 'TEST_PLAYER_AWS_REGION'),
        awsUrl: requireEnv(env, 'ECHOCAST_AWS_URL', 'NEW_DUBRIGHT_AWS_URL', 'TEST_PLAYER_AWS_URL'),
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
