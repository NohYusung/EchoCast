import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { ArtistService } from './applications/artist.service';
import { ArtistController } from './controllers/artist.controller';
import { ArtistRepository } from './repository/artist.repository';

@Module({
    imports: [DatabasesModule],
    controllers: [ArtistController],
    providers: [
        {
            provide: ArtistRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new ArtistRepository(dataSource),
        },
        {
            provide: ArtistService,
            inject: [ArtistRepository],
            useFactory: (artistRepository: ArtistRepository) => new ArtistService(artistRepository),
        },
    ],
    exports: [ArtistRepository, ArtistService],
})
export class ArtistModule {}
