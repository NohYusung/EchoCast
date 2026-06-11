import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { TtsVoiceRepository } from '../TTS-voices/repository/tts-voice.repository';
import { CanvasRepository } from '../canvases/repository/canvas.repository';
import { CharacterRepository } from '../characters/repository/characater.repository';
import { CueRepository } from '../cues/repository/cue.repository';
import { EpisodeRepository } from '../episodes/repository/episode.repository';
import { RecordRepository } from '../records/repository/record.repository';
import { ScrollRepository } from '../scrolls/repository/scroll.repository';
import { TrackRepository } from '../tracks/repository/track.repository';
import { PlayerService } from './applications/player.service';
import { PlayerController } from './controllers/player.controller';

@Module({
    imports: [DatabasesModule],
    controllers: [PlayerController],
    providers: [
        {
            provide: EpisodeRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new EpisodeRepository(dataSource),
        },
        {
            provide: CharacterRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CharacterRepository(dataSource),
        },
        {
            provide: TrackRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new TrackRepository(dataSource),
        },
        {
            provide: CanvasRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CanvasRepository(dataSource),
        },
        {
            provide: CueRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CueRepository(dataSource),
        },
        {
            provide: ScrollRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new ScrollRepository(dataSource),
        },
        {
            provide: RecordRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new RecordRepository(dataSource),
        },
        {
            provide: TtsVoiceRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new TtsVoiceRepository(dataSource),
        },
        {
            provide: PlayerService,
            inject: [
                EpisodeRepository,
                CharacterRepository,
                TrackRepository,
                CanvasRepository,
                CueRepository,
                ScrollRepository,
                RecordRepository,
                TtsVoiceRepository,
            ],
            useFactory: (
                episodeRepository: EpisodeRepository,
                characterRepository: CharacterRepository,
                trackRepository: TrackRepository,
                canvasRepository: CanvasRepository,
                cueRepository: CueRepository,
                scrollRepository: ScrollRepository,
                recordRepository: RecordRepository,
                ttsVoiceRepository: TtsVoiceRepository
            ) =>
                new PlayerService(
                    episodeRepository,
                    characterRepository,
                    trackRepository,
                    canvasRepository,
                    cueRepository,
                    scrollRepository,
                    recordRepository,
                    ttsVoiceRepository
                ),
        },
    ],
    exports: [PlayerService],
})
export class PlayerModule {}
