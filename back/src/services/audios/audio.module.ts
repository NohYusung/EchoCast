import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { CueRepository } from '../cues/repository/cue.repository';
import { TrackRepository } from '../tracks/repository/track.repository';
import { AudioService } from './applications/audio.service';
import { AudioController } from './controllers/audio.controller';
import { AudioRepository } from './repository/audio.repository';

@Module({
    imports: [DatabasesModule],
    controllers: [AudioController],
    providers: [
        {
            provide: AudioRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new AudioRepository(dataSource),
        },
        {
            provide: TrackRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new TrackRepository(dataSource),
        },
        {
            provide: CueRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CueRepository(dataSource),
        },
        {
            provide: AudioService,
            inject: [AudioRepository, TrackRepository, CueRepository],
            useFactory: (audioRepository: AudioRepository, trackRepository: TrackRepository, cueRepository: CueRepository) =>
                new AudioService(audioRepository, trackRepository, cueRepository),
        },
    ],
    exports: [AudioRepository, AudioService],
})
export class AudioModule {}
