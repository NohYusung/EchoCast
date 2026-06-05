import type { DataSourceOptions } from "typeorm";

export interface ServerConfig {
  port: number;
}

export interface AppConfig {
  server: ServerConfig;
  database: DataSourceOptions;
}

function resolveDatabaseConfig(env: Record<string, string | undefined>): DataSourceOptions {
  const mode = env.TEST_PLAYER_DATABASE_MODE === "file" ? "file" : "memory";
  const isProduction = env.NODE_ENV === "production";

  return {
    type: "sqljs",
    location: mode === "file" ? (env.TEST_PLAYER_DB_PATH ?? "test-player.sqlite") : undefined,
    autoSave: mode === "file",
    synchronize: isProduction ? false : true,
    logging: false,
  };
}

export default function configuration(
  env: Record<string, string | undefined> = process.env,
): AppConfig {
  return {
    server: {
      port: Number(env.PORT ?? 4100),
    },
    database: resolveDatabaseConfig(env),
  };
}
