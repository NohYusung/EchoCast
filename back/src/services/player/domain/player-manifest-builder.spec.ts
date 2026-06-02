import { SAMPLE_DUBRIGHT_PLAYER_FIXTURE } from './dubright-player-fixture';
import { buildPlaybackManifestFromDubrightFixture } from './player-manifest-builder';

describe('buildPlaybackManifestFromDubrightFixture', () => {
    it('builds scene, media, and cue based playback manifest data', () => {
        const manifest = buildPlaybackManifestFromDubrightFixture({
            fixture: SAMPLE_DUBRIGHT_PLAYER_FIXTURE,
        });

        expect(manifest.id).toBe('sample-player');
        expect(manifest.durationMs).toBe(22000);
        expect(manifest.scenes.map((scene) => scene.id)).toEqual([
            'scene-001',
            'scene-002',
            'scene-003',
        ]);
        expect(manifest.scenes.map((scene) => scene.media.kind)).toEqual([
            'image',
            'video',
            'image',
        ]);
        expect(manifest.scenes[1].startMs).toBe(7000);
        expect(manifest.scenes[1].cues.map((cue) => cue.startMs)).toEqual([
            7000,
            11000,
        ]);
    });

    it('keeps the output contract away from legacy spoint-shaped scenes', () => {
        const manifest = buildPlaybackManifestFromDubrightFixture({
            fixture: SAMPLE_DUBRIGHT_PLAYER_FIXTURE,
        });

        expect(Object.keys(manifest.scenes[0])).toEqual([
            'id',
            'order',
            'startMs',
            'endMs',
            'media',
            'cues',
        ]);
    });

    it('supports image-only manifests without retiming the source timeline', () => {
        const manifest = buildPlaybackManifestFromDubrightFixture({
            fixture: SAMPLE_DUBRIGHT_PLAYER_FIXTURE,
            variant: 'image-only',
        });

        expect(manifest.variant).toBe('image-only');
        expect(manifest.durationMs).toBe(22000);
        expect(manifest.scenes.map((scene) => scene.id)).toEqual([
            'scene-001',
            'scene-003',
        ]);
        expect(manifest.scenes[1].startMs).toBe(15500);
    });

    it('fails fast when a timeline item references unknown media', () => {
        expect(() =>
            buildPlaybackManifestFromDubrightFixture({
                fixture: {
                    ...SAMPLE_DUBRIGHT_PLAYER_FIXTURE,
                    timeline: [
                        {
                            id: 'scene-broken',
                            mediaId: 'missing-media',
                            durationMs: 1000,
                            cues: [],
                        },
                    ],
                },
            })
        ).toThrow('Unknown media fixture: missing-media');
    });
});
