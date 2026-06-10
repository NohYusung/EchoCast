import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { TrackService } from './applications/track.service';
import { TrackController } from './controllers/track.controller';
import { TrackRepository } from './repository/track.repository';

@Module({
    imports: [DatabasesModule],
    controllers: [TrackController],
    providers: [
        {
            provide: TrackRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new TrackRepository(dataSource),
        },
        {
            provide: TrackService,
            inject: [TrackRepository],
            useFactory: (trackRepository: TrackRepository) => new TrackService(trackRepository),
        },
    ],
    exports: [TrackRepository, TrackService],
})
export class TrackModule {}
