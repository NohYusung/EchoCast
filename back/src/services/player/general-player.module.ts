import { Module } from '@nestjs/common';
import { GeneralPlayerService } from './applications/general-player.service';
import { GeneralPlayerController } from './controllers/general-player.controller';

@Module({
    controllers: [GeneralPlayerController],
    providers: [GeneralPlayerService],
    exports: [GeneralPlayerService],
})
export class GeneralPlayerModule {}

