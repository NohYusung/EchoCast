import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { ScriptService } from './applications/script.service';
import { ScriptRepository } from './repository/script.repository';

@Module({
    imports: [DatabasesModule],
    providers: [
        {
            provide: ScriptRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new ScriptRepository(dataSource),
        },
        {
            provide: ScriptService,
            inject: [ScriptRepository],
            useFactory: (scriptRepository: ScriptRepository) => new ScriptService(scriptRepository),
        },
    ],
    exports: [ScriptRepository, ScriptService],
})
export class ScriptModule {}
