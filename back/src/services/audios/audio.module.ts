import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
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
            provide: AudioService,
            inject: [AudioRepository, TrackRepository],
            useFactory: (audioRepository: AudioRepository, trackRepository: TrackRepository) =>
                new AudioService(audioRepository, trackRepository),
        },
    ],
    exports: [AudioRepository, AudioService],
})
export class AudioModule {}
