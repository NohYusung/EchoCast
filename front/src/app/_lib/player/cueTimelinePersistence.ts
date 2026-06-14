export type CueTimelineTiming = {
    start: number;
    duration: number;
};

export type CueTimingUpdateRequest = {
    startTime: number;
    endTime: number;
};

export type CueMutationTimelineClip = {
    id: string;
    track: string;
};

export function getCueApiIdFromTimelineClipId(clipId: string) {
    const match = /^cue-(\d+)$/.exec(clipId);

    return match?.[1] ?? null;
}

export function toCueMutationTarget(clip: CueMutationTimelineClip) {
    const cueId = getCueApiIdFromTimelineClipId(clip.id);

    if (!cueId) {
        return null;
    }

    return {
        trackId: clip.track,
        cueId,
    };
}

export function toCueTimingUpdateRequest(timing: CueTimelineTiming): CueTimingUpdateRequest {
    const startTime = Math.round(timing.start * 1000);

    return {
        startTime,
        endTime: Math.round((timing.start + timing.duration) * 1000),
    };
}
