type VideoDurationElement = {
    duration: number;
    onerror: GlobalEventHandlers['onerror'];
    onloadedmetadata: GlobalEventHandlers['onloadedmetadata'];
    preload: string;
    src: string;
    load: () => void;
    removeAttribute: (name: string) => void;
};

type VideoDurationTimer = unknown;

type VideoDurationDependencies = {
    clearTimeout?: (timeout: VideoDurationTimer) => void;
    createObjectUrl: (file: File) => string;
    createVideo: () => VideoDurationElement;
    fallbackTimeoutMs?: number;
    revokeObjectUrl: (objectUrl: string) => void;
    setTimeout?: (handler: () => void, timeoutMs: number) => VideoDurationTimer;
};

function toDurationMs(durationSeconds: number) {
    return Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.round(durationSeconds * 1000) : undefined;
}

export function getVideoDurationWithDependencies(file: File, dependencies: VideoDurationDependencies) {
    return new Promise<number | undefined>((resolve) => {
        const {
            clearTimeout: cancelTimeout,
            createObjectUrl,
            createVideo,
            fallbackTimeoutMs,
            revokeObjectUrl,
            setTimeout: scheduleTimeout,
        } = dependencies;
        const objectUrl = createObjectUrl(file);
        const video = createVideo();
        let fallbackTimeout: VideoDurationTimer | undefined;
        let isResolved = false;

        const cleanup = () => {
            if (fallbackTimeout && cancelTimeout) {
                cancelTimeout(fallbackTimeout);
            }
            video.onerror = null;
            video.onloadedmetadata = null;
            revokeObjectUrl(objectUrl);
            video.removeAttribute('src');
            video.load();
        };
        const finish = (duration: number | undefined) => {
            if (isResolved) return;
            isResolved = true;
            cleanup();
            resolve(duration);
        };

        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            finish(toDurationMs(video.duration));
        };
        video.onerror = () => {
            finish(undefined);
        };

        if (scheduleTimeout && typeof fallbackTimeoutMs === 'number' && fallbackTimeoutMs > 0) {
            fallbackTimeout = scheduleTimeout(() => {
                finish(undefined);
            }, fallbackTimeoutMs);
        }

        video.src = objectUrl;
        video.load();
    });
}

export function getVideoDuration(file: File) {
    return getVideoDurationWithDependencies(file, {
        clearTimeout: (timeout) => window.clearTimeout(timeout as number),
        createObjectUrl: (targetFile) => URL.createObjectURL(targetFile),
        createVideo: () => document.createElement('video'),
        fallbackTimeoutMs: 3000,
        revokeObjectUrl: (objectUrl) => URL.revokeObjectURL(objectUrl),
        setTimeout: (handler, timeout) => window.setTimeout(handler, timeout),
    });
}
