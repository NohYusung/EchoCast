import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { ScrollsService } from './applications/scrolls.service';
import { ScrollsController } from './controllers/scrolls.controller';
import { ScrollRepository } from './repository/scroll.repository';

@Module({
    imports: [DatabasesModule],
    controllers: [ScrollsController],
    providers: [
        {
            provide: ScrollRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new ScrollRepository(dataSource),
        },
        {
            provide: ScrollsService,
            inject: [ScrollRepository],
            useFactory: (scrollRepository: ScrollRepository) => new ScrollsService(scrollRepository),
        },
    ],
    exports: [ScrollRepository, ScrollsService],
})
export class ScrollsModule {}
