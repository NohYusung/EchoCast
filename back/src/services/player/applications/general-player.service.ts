import { Injectable, NotFoundException } from '@nestjs/common';
import {
    PlaybackManifest,
    PlayerManifestVariant,
    SAMPLE_PLAYBACK_MANIFEST,
} from '../domain/playback-manifest';

@Injectable()
export class GeneralPlayerService {
    getManifest(args: {
        manifestId: string;
        variant?: PlayerManifestVariant;
    }): PlaybackManifest {
        if (args.manifestId !== SAMPLE_PLAYBACK_MANIFEST.id) {
            throw new NotFoundException('Player manifest not found');
        }

        const variant = args.variant ?? 'image-video';
        const scenes =
            variant === 'image-only'
                ? SAMPLE_PLAYBACK_MANIFEST.scenes.filter(
                      (scene) => scene.media.kind === 'image'
                  )
                : SAMPLE_PLAYBACK_MANIFEST.scenes;

        return {
            ...SAMPLE_PLAYBACK_MANIFEST,
            variant,
            scenes,
        };
    }
}

