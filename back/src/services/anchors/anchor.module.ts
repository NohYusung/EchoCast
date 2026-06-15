import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { CanvasModule } from '../canvases/canvas.module';
import { CanvasRepository } from '../canvases/repository/canvas.repository';
import { ScrollRepository } from '../scrolls/repository/scroll.repository';
import { TrackModule } from '../tracks/track.module';
import { TrackRepository } from '../tracks/repository/track.repository';
import { AnchorService } from './applications/anchor.service';
import { AnchorController } from './controllers/anchor.controller';
import { AnchorRepository } from './repository/anchor.repository';

@Module({
    imports: [DatabasesModule, TrackModule, CanvasModule],
    controllers: [AnchorController],
    providers: [
        {
            provide: AnchorRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new AnchorRepository(dataSource),
        },
        {
            provide: AnchorService,
            inject: [AnchorRepository, TrackRepository, CanvasRepository, ScrollRepository],
            useFactory: (
                anchorRepository: AnchorRepository,
                trackRepository: TrackRepository,
                canvasRepository: CanvasRepository,
                scrollRepository: ScrollRepository
            ) => new AnchorService(anchorRepository, trackRepository, canvasRepository, scrollRepository),
        },
        {
            provide: ScrollRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new ScrollRepository(dataSource),
        },
    ],
    exports: [AnchorRepository, AnchorService],
})
export class AnchorModule {}
