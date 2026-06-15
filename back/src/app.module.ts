import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigsModule } from './configs';
import { AnchorModule } from './services/anchors/anchor.module';
import { ArtistModule } from './services/artists/artist.module';
import { AudioModule } from './services/audios/audio.module';
import { CanvasModule } from './services/canvases/canvas.module';
import { CharacterModule } from './services/characters/characater.module';
import { CueModule } from './services/cues/cue.module';
import { EpisodeModule } from './services/episodes/episode.module';
import { FileModule } from './services/files/file.module';
import { MediaModule } from './services/medias/media.module';
import { PlayerModule } from './services/players/player.module';
import { ProductModule } from './services/products/product.module';
import { RecordModule } from './services/records/record.module';
import { ScrollsModule } from './services/scrolls/scrolls.module';
import { TrackModule } from './services/tracks/track.module';

@Module({
    imports: [
        ConfigsModule,
        AnchorModule,
        ArtistModule,
        AudioModule,
        ProductModule,
        CharacterModule,
        CueModule,
        EpisodeModule,
        TrackModule,
        MediaModule,
        CanvasModule,
        RecordModule,
        PlayerModule,
        ScrollsModule,
        FileModule,
    ],
})
export class AppModule {}
