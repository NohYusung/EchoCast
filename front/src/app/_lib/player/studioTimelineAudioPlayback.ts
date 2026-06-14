export type StudioTimelineAudioClip = {
    id: string;
    track: string;
    start: number;
    duration: number;
    audioUrl?: string;
    audioStart?: number;
    audioEnd?: number;
    volume?: number;
};

export type StudioTimelineAudioElement = {
    currentTime: number;
    paused: boolean;
    volume: number;
    play: () => Promise<void> | void;
    pause: () => void;
};

export type StudioTimelineAudioEntry = {
    audio: StudioTimelineAudioElement;
    url: string;
};

export type StudioTimelineAudioState = Map<string, StudioTimelineAudioEntry>;

type SyncStudioTimelineAudioPlaybackRequest = {
    audioByClipId: StudioTimelineAudioState;
    clips: StudioTimelineAudioClip[];
    createAudio: (url: string) => StudioTimelineAudioElement;
    isPlaying: boolean;
    mutedTrackIds: string[];
    playhead: number;
    seekToleranceSeconds?: number;
    soloTrackIds: string[];
};

function clampAudioVolume(volume: number | undefined) {
    if (volume === undefined || !Number.isFinite(volume)) return 1;

    return Math.min(Math.max(volume, 0), 1);
}

function pauseAndResetAudio(audio: StudioTimelineAudioElement) {
    audio.pause();

    if (audio.currentTime > 0) {
        audio.currentTime = 0;
    }
}

function playAudio(audio: StudioTimelineAudioElement) {
    const playResult = audio.play();

    if (playResult && typeof playResult.catch === 'function') {
        void playResult.catch(() => undefined);
    }
}

export function stopStudioTimelineAudioPlayback(audioByClipId: StudioTimelineAudioState) {
    audioByClipId.forEach(({ audio }) => pauseAndResetAudio(audio));
    audioByClipId.clear();
}

export function syncStudioTimelineAudioPlayback({
    audioByClipId,
    clips,
    createAudio,
    isPlaying,
    mutedTrackIds,
    playhead,
    seekToleranceSeconds = 0.25,
    soloTrackIds,
}: SyncStudioTimelineAudioPlaybackRequest) {
    const mutedTrackIdSet = new Set(mutedTrackIds);
    const soloTrackIdSet = new Set(soloTrackIds);
    const liveAudioClipIds = new Set<string>();

    for (const clip of clips) {
        if (!clip.audioUrl) continue;

        liveAudioClipIds.add(clip.id);

        const isTrackAudible = !mutedTrackIdSet.has(clip.track) && (soloTrackIdSet.size === 0 || soloTrackIdSet.has(clip.track));
        const isActive = isPlaying && isTrackAudible && clip.start <= playhead && playhead < clip.start + clip.duration;
        const existingEntry = audioByClipId.get(clip.id);
        const entry =
            existingEntry?.url === clip.audioUrl
                ? existingEntry
                : {
                      audio: createAudio(clip.audioUrl),
                      url: clip.audioUrl,
                  };

        if (entry !== existingEntry) {
            if (existingEntry) {
                pauseAndResetAudio(existingEntry.audio);
            }
            audioByClipId.set(clip.id, entry);
        }

        if (!isActive) {
            pauseAndResetAudio(entry.audio);
            continue;
        }

        const targetTime = Math.max(0, clip.audioStart ?? 0) + Math.max(0, playhead - clip.start);
        if (Math.abs(entry.audio.currentTime - targetTime) > seekToleranceSeconds) {
            entry.audio.currentTime = targetTime;
        }

        entry.audio.volume = clampAudioVolume(clip.volume);

        if (entry.audio.paused) {
            playAudio(entry.audio);
        }
    }

    audioByClipId.forEach((entry, clipId) => {
        if (liveAudioClipIds.has(clipId)) return;

        pauseAndResetAudio(entry.audio);
        audioByClipId.delete(clipId);
    });
}
