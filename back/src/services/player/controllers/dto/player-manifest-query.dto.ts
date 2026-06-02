import { IsIn, IsOptional } from 'class-validator';
import { PLAYER_MANIFEST_VARIANTS, PlayerManifestVariant } from '../../domain/playback-manifest';

export class PlayerManifestQueryDto {
    @IsOptional()
    @IsIn(PLAYER_MANIFEST_VARIANTS)
    variant?: PlayerManifestVariant;
}

