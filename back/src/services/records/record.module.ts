import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
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
            provide: RecordService,
            inject: [RecordRepository],
            useFactory: (recordRepository: RecordRepository) => new RecordService(recordRepository),
        },
    ],
    exports: [RecordRepository, RecordService],
})
export class RecordModule {}
