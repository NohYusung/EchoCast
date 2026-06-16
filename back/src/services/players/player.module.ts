import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { AnchorRepository } from '../anchors/repository/anchor.repository';
import { AudioRepository } from '../audios/repository/audio.repository';
import { CanvasRepository } from '../canvases/repository/canvas.repository';
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
            provide: AudioRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new AudioRepository(dataSource),
        },
        {
            provide: AnchorRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new AnchorRepository(dataSource),
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
            provide: PlayerService,
            inject: [
                EpisodeRepository,
                TrackRepository,
                CanvasRepository,
                CueRepository,
                AudioRepository,
                AnchorRepository,
                ScrollRepository,
                RecordRepository,
            ],
            useFactory: (
                episodeRepository: EpisodeRepository,
                trackRepository: TrackRepository,
                canvasRepository: CanvasRepository,
                cueRepository: CueRepository,
                audioRepository: AudioRepository,
                anchorRepository: AnchorRepository,
                scrollRepository: ScrollRepository,
                recordRepository: RecordRepository
            ) =>
                new PlayerService(
                    episodeRepository,
                    trackRepository,
                    canvasRepository,
                    cueRepository,
                    audioRepository,
                    anchorRepository,
                    scrollRepository,
                    recordRepository
                ),
        },
    ],
    exports: [PlayerService],
})
export class PlayerModule {}
