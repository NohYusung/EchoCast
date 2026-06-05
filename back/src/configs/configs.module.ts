import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import configuration from "./configuration";
import { ConfigsService } from "./configs.service";

function validateConfigObject(envConfig: Record<string, string | undefined>) {
  const config = configuration(envConfig);
  if (!Number.isFinite(config.server.port)) {
    throw new Error('PORT 설정 값이 올바른 숫자가 아닙니다.');
  }
  return envConfig;
}

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV || "local"}`,
      load: [configuration],
      validate: validateConfigObject,
    }),
  ],
  providers: [ConfigsService],
  exports: [ConfigsService],
})
export class ConfigsModule {}
