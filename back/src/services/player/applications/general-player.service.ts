import { Injectable, NotFoundException } from '@nestjs/common';
import type {
    PlaybackManifest,
    PlayerManifestVariant,
} from '../domain/playback-manifest';
import { SAMPLE_DUBRIGHT_PLAYER_FIXTURE } from '../domain/dubright-player-fixture';
import { buildPlaybackManifestFromDubrightFixture } from '../domain/player-manifest-builder';

@Injectable()
export class GeneralPlayerService {
    getManifest(args: {
        manifestId: string;
        variant?: PlayerManifestVariant;
    }): PlaybackManifest {
        if (args.manifestId !== SAMPLE_DUBRIGHT_PLAYER_FIXTURE.id) {
            throw new NotFoundException('Player manifest not found');
        }

        return buildPlaybackManifestFromDubrightFixture({
            fixture: SAMPLE_DUBRIGHT_PLAYER_FIXTURE,
            variant: args.variant,
        });
    }
}
