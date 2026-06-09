import { Module } from '@nestjs/common';
import { ScriptRepository } from './repository/script.repository';

@Module({
    imports: [],
    controllers: [],
    providers: [ScriptRepository],
    exports: [ScriptRepository],
})
export class ScriptModule {}
