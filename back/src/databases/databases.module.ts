import {
  Inject,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { ConfigsService } from "../configs";
import entities from "./entities";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigsService],
      useFactory: (configsService: ConfigsService) => ({
        ...configsService.database,
        entities,
        synchronize: configsService.isProduction() ? false : true,
        logging: false,
      }),
    }),
  ],
})
export class DatabasesModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabasesModule.name);

  constructor(
    @Inject(DataSource)
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    if (!this.dataSource.isInitialized) {
      throw new Error("test-player database is not initialized.");
    }
    this.logger.log("test-player database is initialized.");
  }

  async onModuleDestroy() {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
