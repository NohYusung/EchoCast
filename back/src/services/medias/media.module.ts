import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Context, ContextModule } from '../../common/context';
import { DatabasesModule } from '../../databases';
import { MediaService } from './applications/media.service';
import { MediaController } from './controllers/media.controller';
import { MediaRepository } from './repository/media.repository';

@Module({
    imports: [DatabasesModule, ContextModule],
    controllers: [MediaController],
    providers: [
        {
            provide: MediaRepository,
            inject: [DataSource, Context],
            useFactory: (dataSource: DataSource, context: Context) => new MediaRepository(dataSource, context),
        },
        {
            provide: MediaService,
            inject: [MediaRepository, DataSource, Context],
            useFactory: (mediaRepository: MediaRepository, dataSource: DataSource, context: Context) => {
                const mediaService = new MediaService(mediaRepository);

                mediaService.entityManager = dataSource.manager;
                mediaService.context = context;

                return mediaService;
            },
        },
    ],
    exports: [MediaRepository, MediaService],
})
export class MediaModule {}
