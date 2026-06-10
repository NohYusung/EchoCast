import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { MediaService } from './applications/media.service';
import { MediaController } from './controllers/media.controller';
import { MediaRepository } from './repository/media.repository';

@Module({
    imports: [DatabasesModule],
    controllers: [MediaController],
    providers: [
        {
            provide: MediaRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new MediaRepository(dataSource),
        },
        {
            provide: MediaService,
            inject: [MediaRepository],
            useFactory: (mediaRepository: MediaRepository) => new MediaService(mediaRepository),
        },
    ],
    exports: [MediaRepository, MediaService],
})
export class MediaModule {}
