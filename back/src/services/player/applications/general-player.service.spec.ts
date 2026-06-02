import { NotFoundException } from '@nestjs/common';
import { GeneralPlayerService } from './general-player.service';

describe('GeneralPlayerService', () => {
    it('returns image and video scenes by default', () => {
        const service = new GeneralPlayerService();

        const manifest = service.getManifest({ manifestId: 'sample-player' });

        expect(manifest.scenes.map((scene) => scene.media.kind)).toEqual([
            'image',
            'video',
            'image',
        ]);
    });

    it('filters to image scenes for the image-only variant', () => {
        const service = new GeneralPlayerService();

        const manifest = service.getManifest({
            manifestId: 'sample-player',
            variant: 'image-only',
        });

        expect(manifest.scenes).toHaveLength(2);
        expect(manifest.scenes.every((scene) => scene.media.kind === 'image')).toBe(
            true
        );
    });

    it('rejects unknown manifests', () => {
        const service = new GeneralPlayerService();

        expect(() => service.getManifest({ manifestId: 'missing' })).toThrow(
            NotFoundException
        );
    });
});

