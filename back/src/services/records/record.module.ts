import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
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
            provide: CueRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CueRepository(dataSource),
        },
        {
            provide: RecordService,
            inject: [RecordRepository, CueRepository],
            useFactory: (recordRepository: RecordRepository, cueRepository: CueRepository) =>
                new RecordService(recordRepository, cueRepository),
        },
    ],
    exports: [RecordRepository, RecordService],
})
export class RecordModule {}
