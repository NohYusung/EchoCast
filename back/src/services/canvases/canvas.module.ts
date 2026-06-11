import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { CanvasService } from './applications/canvas.service';
import { CanvasController } from './controllers/canvas.controller';
import { CanvasRepository } from './repository/canvas.repository';

@Module({
    imports: [DatabasesModule],
    controllers: [CanvasController],
    providers: [
        {
            provide: CanvasRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CanvasRepository(dataSource),
        },
        {
            provide: CanvasService,
            inject: [CanvasRepository],
            useFactory: (canvasRepository: CanvasRepository) => new CanvasService(canvasRepository),
        },
    ],
    exports: [CanvasRepository, CanvasService],
})
export class CanvasModule {}
