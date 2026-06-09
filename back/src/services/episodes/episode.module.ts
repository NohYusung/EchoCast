import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { EpisodeService } from './applications/episode.service';
import { EpisodeController } from './controllers/episode.controller';
import { EpisodeRepository } from './repository/episode.repository';

@Module({
    imports: [DatabasesModule],
    controllers: [EpisodeController],
    providers: [
        {
            provide: EpisodeRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new EpisodeRepository(dataSource),
        },
        {
            provide: EpisodeService,
            inject: [EpisodeRepository],
            useFactory: (episodeRepository: EpisodeRepository) => new EpisodeService(episodeRepository),
        },
    ],
    exports: [EpisodeRepository, EpisodeService],
})
export class EpisodeModule {}
