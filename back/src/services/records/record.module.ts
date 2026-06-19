import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { AudioRepository } from '../audios/repository/audio.repository';
import { CueRepository } from '../cues/repository/cue.repository';
import { RecordService } from './applications/record.service';
import { RecordController } from './controllers/record.controller';
import { RecordRepository } from './repository/record.repository';

@Module({
    imports: [DatabasesModule],
    controllers: [RecordController],
    providers: [
        {
            provide: RecordRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new RecordRepository(dataSource),
        },
        {
            provide: AudioRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new AudioRepository(dataSource),
        },
        {
            provide: CueRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CueRepository(dataSource),
        },
        {
            provide: RecordService,
            inject: [RecordRepository, AudioRepository, CueRepository],
            useFactory: (
                recordRepository: RecordRepository,
                audioRepository: AudioRepository,
                cueRepository: CueRepository
            ) => new RecordService(recordRepository, audioRepository, cueRepository),
        },
    ],
    exports: [RecordRepository, RecordService],
})
export class RecordModule {}
