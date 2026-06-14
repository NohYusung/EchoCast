import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { AnchorRepository } from '../anchors/repository/anchor.repository';
import { ScrollRepository } from '../scrolls/repository/scroll.repository';
import { PauseService } from './applications/pause.service';
import { PauseController } from './controllers/pause.controller';
import { PauseRepository } from './repository/pause.repository';

@Module({
    imports: [DatabasesModule],
    controllers: [PauseController],
    providers: [
        {
            provide: PauseRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new PauseRepository(dataSource),
        },
        {
            provide: AnchorRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new AnchorRepository(dataSource),
        },
        {
            provide: PauseService,
            inject: [PauseRepository, AnchorRepository, ScrollRepository],
            useFactory: (pauseRepository: PauseRepository, anchorRepository: AnchorRepository, scrollRepository: ScrollRepository) =>
                new PauseService(pauseRepository, anchorRepository, scrollRepository),
        },
        {
            provide: ScrollRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new ScrollRepository(dataSource),
        },
    ],
    exports: [PauseRepository, PauseService],
})
export class PauseModule {}
