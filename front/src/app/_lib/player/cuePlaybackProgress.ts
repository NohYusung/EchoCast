export type CuePlaybackProgressTarget = {
    id?: string;
    start: number;
    duration: number;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function formatCuePlaybackClock(seconds: number) {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}초`;
}

export function getCuePlaybackProgressLabel(target: CuePlaybackProgressTarget, playhead: number) {
    const cueEnd = target.start + target.duration;

    if (target.duration <= 0 || playhead < target.start || playhead >= cueEnd) {
        return null;
    }

    const elapsed = clamp(playhead - target.start, 0, target.duration);

    return `${formatCuePlaybackClock(elapsed)} / ${formatCuePlaybackClock(target.duration)}`;
}

export function getActiveCuePlaybackProgressLabel(
    targets: CuePlaybackProgressTarget[],
    playhead: number,
    preferredTargetId?: string,
) {
    if (preferredTargetId) {
        const preferredTarget = targets.find((target) => target.id === preferredTargetId);
        const preferredProgress = preferredTarget ? getCuePlaybackProgressLabel(preferredTarget, playhead) : null;

        if (preferredProgress) {
            return preferredProgress;
        }
    }

    for (const target of targets) {
        const progress = getCuePlaybackProgressLabel(target, playhead);

        if (progress) {
            return progress;
        }
    }

    return null;
}
