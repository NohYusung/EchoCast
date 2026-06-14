import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { AnchorRepository } from '../anchors/repository/anchor.repository';
import { PauseRepository } from '../pauses/repository/pause.repository';
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
            provide: AnchorRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new AnchorRepository(dataSource),
        },
        {
            provide: ScrollsService,
            inject: [ScrollRepository, AnchorRepository, PauseRepository],
            useFactory: (scrollRepository: ScrollRepository, anchorRepository: AnchorRepository, pauseRepository: PauseRepository) =>
                new ScrollsService(scrollRepository, anchorRepository, pauseRepository),
        },
        {
            provide: PauseRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new PauseRepository(dataSource),
        },
    ],
    exports: [ScrollRepository, ScrollsService],
})
export class ScrollsModule {}
