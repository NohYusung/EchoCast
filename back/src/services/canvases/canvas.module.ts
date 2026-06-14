import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { CanvasMediaRepository } from '../canvas-medias/repository/canvas-media.repository';
import { CanvasService } from './applications/canvas.service';
import { CanvasController } from './controllers/canvas.controller';
import { CanvasRepository } from './repository/canvas.repository';
import { MediaModule } from '../medias/media.module';
import { MediaRepository } from '../medias/repository/media.repository';

@Module({
    imports: [DatabasesModule, MediaModule],
    controllers: [CanvasController],
    providers: [
        {
            provide: CanvasRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CanvasRepository(dataSource),
        },
        {
            provide: CanvasService,
            inject: [CanvasRepository, MediaRepository, CanvasMediaRepository],
            useFactory: (
                canvasRepository: CanvasRepository,
                mediaRepository: MediaRepository,
                canvasMediaRepository: CanvasMediaRepository
            ) => new CanvasService(canvasRepository, mediaRepository, canvasMediaRepository),
        },
        {
            provide: CanvasMediaRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CanvasMediaRepository(dataSource),
        },
    ],
    exports: [CanvasRepository, CanvasService],
})
export class CanvasModule {}
