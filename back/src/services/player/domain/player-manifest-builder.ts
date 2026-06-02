import type {
    PlaybackCue,
    PlaybackManifest,
    PlaybackMedia,
    PlayerManifestVariant,
} from './playback-manifest';
import type {
    DubrightPlayerCueFixture,
    DubrightPlayerFixture,
} from './dubright-player-fixture';

export function buildPlaybackManifestFromDubrightFixture(args: {
    fixture: DubrightPlayerFixture;
    variant?: PlayerManifestVariant;
}): PlaybackManifest {
    const variant = args.variant ?? 'image-video';
    const mediaById = new Map(
        args.fixture.media.map((media) => [media.id, media])
    );
    let timelineCursorMs = 0;
    const scenes: PlaybackManifest['scenes'] = [];

    for (const [index, timelineItem] of args.fixture.timeline.entries()) {
        const mediaFixture = mediaById.get(timelineItem.mediaId);
        if (!mediaFixture) {
            throw new Error(`Unknown media fixture: ${timelineItem.mediaId}`);
        }

        const sceneStartMs = timelineCursorMs;
        const sceneEndMs = sceneStartMs + timelineItem.durationMs;
        timelineCursorMs = sceneEndMs;

        if (variant === 'image-only' && mediaFixture.kind !== 'image') {
            continue;
        }

        const media: PlaybackMedia = {
            kind: mediaFixture.kind,
            src: mediaFixture.src,
            poster: mediaFixture.poster,
            width: mediaFixture.width,
            height: mediaFixture.height,
        };

        scenes.push({
            id: timelineItem.id,
            order: index + 1,
            startMs: sceneStartMs,
            endMs: sceneEndMs,
            media,
            cues: timelineItem.cues
                .map((cue) => toPlaybackCue(cue, sceneStartMs, sceneEndMs))
                .filter((cue) => cue.endMs > cue.startMs),
        });
    }

    return {
        id: args.fixture.id,
        title: args.fixture.title,
        variant,
        durationMs: timelineCursorMs,
        scenes,
    };
}

function toPlaybackCue(
    cue: DubrightPlayerCueFixture,
    sceneStartMs: number,
    sceneEndMs: number
): PlaybackCue {
    const startMs = sceneStartMs + cue.offsetMs;
    const endMs = Math.min(startMs + cue.durationMs, sceneEndMs);

    return {
        id: cue.id,
        startMs,
        endMs,
        label: cue.label,
        viewport: cue.viewport,
    };
}
