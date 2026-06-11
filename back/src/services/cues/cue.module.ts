import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { TrackModule } from '../tracks/track.module';
import { TrackRepository } from '../tracks/repository/track.repository';
import { CueService } from './applications/cue.service';
import { CueController } from './controllers/cue.controller';
import { CueRepository } from './repository/cue.repository';

@Module({
    imports: [DatabasesModule, TrackModule],
    controllers: [CueController],
    providers: [
        {
            provide: CueRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CueRepository(dataSource),
        },
        {
            provide: CueService,
            inject: [CueRepository, TrackRepository],
            useFactory: (cueRepository: CueRepository, trackRepository: TrackRepository) =>
                new CueService(cueRepository, trackRepository),
        },
    ],
    exports: [CueRepository, CueService],
})
export class CueModule {}
