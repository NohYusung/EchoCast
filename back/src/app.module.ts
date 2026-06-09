import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigsModule } from './configs';
import { CharacterModule } from './services/characters/characater.module';
import { EpisodeModule } from './services/episodes/episode.module';
import { ProductModule } from './services/products/product.module';

@Module({
    imports: [ConfigsModule, ProductModule, CharacterModule, EpisodeModule],
})
export class AppModule {}
