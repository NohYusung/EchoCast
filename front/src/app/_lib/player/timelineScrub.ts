type TimelineScrubStateArgs = {
    seconds: number;
    timelineDurationSeconds: number;
    manualTimelineDurationSeconds: number;
    isPlaying: boolean;
};

export function getTimelineScrubState({
    seconds,
    timelineDurationSeconds,
    manualTimelineDurationSeconds,
    isPlaying,
}: TimelineScrubStateArgs) {
    const nextSeconds = Math.max(0, seconds);

    return {
        isPlaying,
        manualTimelineDurationSeconds: Math.max(manualTimelineDurationSeconds, Math.ceil(nextSeconds)),
        playhead: Math.min(Math.max(nextSeconds, 0), Math.max(timelineDurationSeconds, nextSeconds)),
    };
}
