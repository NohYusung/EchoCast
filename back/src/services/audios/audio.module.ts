import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
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
            provide: AudioService,
            inject: [AudioRepository],
            useFactory: (audioRepository: AudioRepository) => new AudioService(audioRepository),
        },
    ],
    exports: [AudioRepository, AudioService],
})
export class AudioModule {}
