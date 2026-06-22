import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { CanvasMediaRepository } from '../canvas-medias/repository/canvas-media.repository';
import { ScriptModule } from '../scripts/script.module';
import { ScriptRepository } from '../scripts/repository/script.repository';
import { TrackModule } from '../tracks/track.module';
import { TrackRepository } from '../tracks/repository/track.repository';
import { CueService } from './applications/cue.service';
import { CueController } from './controllers/cue.controller';
import { CueRepository } from './repository/cue.repository';

@Module({
    imports: [DatabasesModule, TrackModule, ScriptModule],
    controllers: [CueController],
    providers: [
        {
            provide: CueRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CueRepository(dataSource),
        },
        {
            provide: CanvasMediaRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CanvasMediaRepository(dataSource),
        },
        {
            provide: CueService,
            inject: [CueRepository, TrackRepository, CanvasMediaRepository, ScriptRepository],
            useFactory: (
                cueRepository: CueRepository,
                trackRepository: TrackRepository,
                canvasMediaRepository: CanvasMediaRepository,
                scriptRepository: ScriptRepository
            ) => new CueService(cueRepository, trackRepository, canvasMediaRepository, scriptRepository),
        },
    ],
    exports: [CueRepository, CueService],
})
export class CueModule {}
