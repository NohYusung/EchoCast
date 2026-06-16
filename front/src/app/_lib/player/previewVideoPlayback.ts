export type PreviewVideoClip = {
    id: string;
    kind?: string;
    mediaType?: string;
    mediaUrl?: string;
    mediaDuration?: number;
    hasTimelineControls?: boolean;
    sourceStart?: number;
    sourceEnd?: number;
    volume?: number;
    isMuted?: boolean;
    start: number;
    duration: number;
};

type PreviewVideoController = {
    currentTime: number;
    muted: boolean;
    paused?: boolean;
    volume: number;
    play: () => Promise<unknown> | unknown;
    pause: () => void;
};

type PreviewVideoPlaybackSession = {
    activeClipId: string | null;
    isPlaying: boolean;
    playhead: number | null;
    targetTime: number | null;
};

const SMOOTH_PLAYHEAD_STEP_SECONDS = 0.75;

const previewVideoPlaybackSessions = new WeakMap<
    ReadonlyMap<string, PreviewVideoController>,
    PreviewVideoPlaybackSession
>();

function isVideoClip(clip: PreviewVideoClip) {
    return clip.kind === 'video' || clip.mediaType === 'video';
}

function getVideoClipDurationSeconds(clip: PreviewVideoClip) {
    if (clip.hasTimelineControls) {
        return Math.max(0, clip.duration);
    }

    if (
        typeof clip.sourceStart === 'number' &&
        Number.isFinite(clip.sourceStart) &&
        typeof clip.sourceEnd === 'number' &&
        Number.isFinite(clip.sourceEnd) &&
        clip.sourceEnd > clip.sourceStart
    ) {
        return clip.sourceEnd - clip.sourceStart;
    }

    if (typeof clip.mediaDuration === 'number' && Number.isFinite(clip.mediaDuration) && clip.mediaDuration > 0) {
        return clip.mediaDuration / 1000;
    }

    return Math.max(0, clip.duration);
}

function getVideoClipSourceStartSeconds(clip: PreviewVideoClip) {
    return typeof clip.sourceStart === 'number' && Number.isFinite(clip.sourceStart) && clip.sourceStart > 0
        ? clip.sourceStart
        : 0;
}

function getVideoClipVolume(clip: PreviewVideoClip) {
    if (typeof clip.volume !== 'number' || !Number.isFinite(clip.volume)) {
        return 1;
    }

    return Math.min(Math.max(clip.volume, 0), 1);
}

function getPreviewVideoPlaybackTarget({ clips, playhead }: { clips: PreviewVideoClip[]; playhead: number }) {
    const clip = clips.find((item) => {
        if (!isVideoClip(item)) {
            return false;
        }

        const end = item.start + getVideoClipDurationSeconds(item);

        return playhead >= item.start && playhead < end;
    });

    if (!clip) {
        return null;
    }

    return {
        clipId: clip.id,
        currentTime: Number(Math.max(0, getVideoClipSourceStartSeconds(clip) + playhead - clip.start).toFixed(3)),
    };
}

function getPreviewVideoPlaybackSession(videos: ReadonlyMap<string, PreviewVideoController>) {
    const existingSession = previewVideoPlaybackSessions.get(videos);

    if (existingSession) {
        return existingSession;
    }

    const session = {
        activeClipId: null,
        isPlaying: false,
        playhead: null,
        targetTime: null,
    };

    previewVideoPlaybackSessions.set(videos, session);

    return session;
}

function isSmoothPlaybackAdvance({
    playhead,
    session,
    target,
}: {
    playhead: number;
    session: PreviewVideoPlaybackSession;
    target: { clipId: string; currentTime: number };
}) {
    if (session.activeClipId !== target.clipId || session.playhead === null || session.targetTime === null) {
        return false;
    }

    const playheadDelta = playhead - session.playhead;
    const targetDelta = target.currentTime - session.targetTime;

    return (
        playheadDelta >= 0 &&
        playheadDelta <= SMOOTH_PLAYHEAD_STEP_SECONDS &&
        targetDelta >= 0 &&
        targetDelta <= SMOOTH_PLAYHEAD_STEP_SECONDS
    );
}

function shouldSeekVideo({
    isPlaying,
    playhead,
    seekToleranceSeconds,
    session,
    target,
    video,
}: {
    isPlaying: boolean;
    playhead: number;
    seekToleranceSeconds: number;
    session: PreviewVideoPlaybackSession;
    target: { clipId: string; currentTime: number };
    video: PreviewVideoController;
}) {
    const drift = Math.abs(video.currentTime - target.currentTime);

    if (drift <= seekToleranceSeconds) {
        return false;
    }

    if (!isPlaying || !session.isPlaying || session.activeClipId !== target.clipId) {
        return true;
    }

    return !isSmoothPlaybackAdvance({ playhead, session, target });
}

function playVideo(video: PreviewVideoController) {
    if (video.paused === false) {
        return;
    }

    const playResult = video.play();

    if (playResult && typeof (playResult as Promise<unknown>).catch === 'function') {
        void (playResult as Promise<unknown>).catch(() => undefined);
    }
}

function pauseVideo(video: PreviewVideoController) {
    if (video.paused === true) {
        return;
    }

    video.pause();
}

export function syncPreviewVideoPlayback({
    clips,
    isPlaying,
    playhead,
    seekToleranceSeconds = 0.25,
    videos,
}: {
    clips: PreviewVideoClip[];
    isPlaying: boolean;
    playhead: number;
    seekToleranceSeconds?: number;
    videos: ReadonlyMap<string, PreviewVideoController>;
}) {
    const target = getPreviewVideoPlaybackTarget({ clips, playhead });
    const session = getPreviewVideoPlaybackSession(videos);

    clips.forEach((clip) => {
        if (!isVideoClip(clip)) {
            return;
        }

        const video = videos.get(clip.id);

        if (!video) {
            return;
        }

        video.volume = getVideoClipVolume(clip);
        video.muted = clip.isMuted === true;

        if (!target || target.clipId !== clip.id) {
            pauseVideo(video);
            return;
        }

        if (shouldSeekVideo({ isPlaying, playhead, seekToleranceSeconds, session, target, video })) {
            video.currentTime = target.currentTime;
        }

        if (!isPlaying) {
            pauseVideo(video);
            return;
        }

        playVideo(video);
    });

    session.activeClipId = target?.clipId ?? null;
    session.isPlaying = isPlaying && Boolean(target);
    session.playhead = playhead;
    session.targetTime = target?.currentTime ?? null;
}
