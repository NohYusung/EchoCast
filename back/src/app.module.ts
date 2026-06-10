import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigsModule } from './configs';
import { CharacterModule } from './services/characters/characater.module';
import { EpisodeModule } from './services/episodes/episode.module';
import { MediaModule } from './services/medias/media.module';
import { ProductModule } from './services/products/product.module';
import { TrackModule } from './services/tracks/track.module';

@Module({
    imports: [ConfigsModule, ProductModule, CharacterModule, EpisodeModule, TrackModule, MediaModule],
})
export class AppModule {}
