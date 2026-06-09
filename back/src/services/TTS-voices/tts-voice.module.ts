import { Module } from '@nestjs/common';
import { TtsVoiceRepository } from './repository/tts-voice.repository';

@Module({
    imports: [],
    controllers: [],
    providers: [TtsVoiceRepository],
    exports: [TtsVoiceRepository],
})
export class TtsVoiceModule {}
