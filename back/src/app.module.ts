import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigsModule } from './configs';
import { GuardModule } from './common/guards/guard.module';
import { HealthModule } from './health/health.module';
import { AnchorModule } from './services/anchors/anchor.module';
import { ArtistModule } from './services/artists/artist.module';
import { AudioModule } from './services/audios/audio.module';
import { CanvasModule } from './services/canvases/canvas.module';
import { CharacterModule } from './services/characters/characater.module';
import { CueModule } from './services/cues/cue.module';
import { EpisodeModule } from './services/episodes/episode.module';
import { FileModule } from './services/files/file.module';
import { MediaModule } from './services/medias/media.module';
import { PermissionModule } from './services/permissions/permission.module';
import { PlayerModule } from './services/players/player.module';
import { ProductModule } from './services/products/product.module';
import { RecordModule } from './services/records/record.module';
import { RoleModule } from './services/roles/role.module';
import { ScriptModule } from './services/scripts/script.module';
import { ScrollsModule } from './services/scrolls/scrolls.module';
import { TrackModule } from './services/tracks/track.module';

@Module({
    imports: [
        ConfigsModule,
        GuardModule,
        HealthModule,
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
        ScriptModule,
        PlayerModule,
        ScrollsModule,
        FileModule,
        PermissionModule,
        RoleModule,
    ],
})
export class AppModule {}
