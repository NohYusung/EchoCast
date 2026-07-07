import { Inject, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigsService } from '../configs';
import { ConfigsModule } from '../configs/configs.module';
import entities from './entities';

export function resolveTypeOrmOptions(configsService: Pick<ConfigsService, 'database'>) {
    return {
        ...configsService.database,
        entities,
    };
}

@Module({
    imports: [
        ConfigsModule,
        TypeOrmModule.forRootAsync({
            inject: [ConfigsService],
            useFactory: resolveTypeOrmOptions,
        }),
    ],
    exports: [TypeOrmModule],
})
export class DatabasesModule implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DatabasesModule.name);

    constructor(
        @Inject(DataSource)
        private readonly dataSource: DataSource
    ) {}

    onModuleInit() {
        if (!this.dataSource.isInitialized) {
            throw new Error('echocast database is not initialized.');
        }
        this.logger.log('echocast database is initialized.');
    }

    async onModuleDestroy() {
        if (this.dataSource.isInitialized) {
            await this.dataSource.destroy();
        }
    }
}
