import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { ConfigsService } from './configs.service';

function validateConfigObject(envConfig: Record<string, string | undefined>) {
    configuration(envConfig);
    return envConfig;
}

@Global()
@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: `.env.${process.env.NODE_ENV || 'local'}`,
            load: [configuration],
            validate: validateConfigObject,
        }),
    ],
    providers: [ConfigsService],
    exports: [ConfigsService],
})
export class ConfigsModule {}
