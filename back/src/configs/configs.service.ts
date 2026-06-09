import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DataSourceOptions } from 'typeorm';
import type { ServerConfig } from './configuration';

@Injectable()
export class ConfigsService {
    constructor(
        @Inject(ConfigService)
        private readonly configService: ConfigService
    ) {}

    get server(): ServerConfig {
        return this.configService.get<ServerConfig>('server')!;
    }

    get database(): DataSourceOptions {
        return this.configService.get<DataSourceOptions>('database')!;
    }

    isProduction(): boolean {
        return process.env.NODE_ENV === 'production';
    }
}
