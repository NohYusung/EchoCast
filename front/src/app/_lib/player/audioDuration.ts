type AudioDurationElement = {
    currentTime: number;
    duration: number;
    ondurationchange: GlobalEventHandlers['ondurationchange'];
    onerror: GlobalEventHandlers['onerror'];
    onloadedmetadata: GlobalEventHandlers['onloadedmetadata'];
    onseeked: GlobalEventHandlers['onseeked'];
    preload: string;
    src: string;
    load: () => void;
    removeAttribute: (name: string) => void;
};

type AudioDurationTimer = unknown;

type AudioDurationDependencies = {
    clearTimeout: (timeout: AudioDurationTimer) => void;
    createAudio: () => AudioDurationElement;
    createObjectUrl: (file: File) => string;
    fallbackTimeoutMs: number;
    revokeObjectUrl: (objectUrl: string) => void;
    setTimeout: (handler: () => void, timeoutMs: number) => AudioDurationTimer;
};

const AUDIO_DURATION_FALLBACK_SEEK_SECONDS = Number.MAX_SAFE_INTEGER;

function toDurationMs(durationSeconds: number) {
    return Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.round(durationSeconds * 1000) : undefined;
}

export function getAudioDurationWithDependencies(file: File, dependencies: AudioDurationDependencies) {
    return new Promise<number | undefined>((resolve) => {
        const {
            clearTimeout: cancelTimeout,
            createAudio,
            createObjectUrl,
            fallbackTimeoutMs,
            revokeObjectUrl,
            setTimeout: scheduleTimeout,
        } = dependencies;
        const objectUrl = createObjectUrl(file);
        const audio = createAudio();
        let fallbackTimeout: AudioDurationTimer | undefined;
        let isResolved = false;
        const cleanup = () => {
            if (fallbackTimeout) {
                cancelTimeout(fallbackTimeout);
            }
            audio.ondurationchange = null;
            audio.onerror = null;
            audio.onloadedmetadata = null;
            audio.onseeked = null;
            revokeObjectUrl(objectUrl);
            audio.removeAttribute('src');
            audio.load();
        };
        const finish = (duration: number | undefined) => {
            if (isResolved) return;
            isResolved = true;
            cleanup();
            resolve(duration);
        };
        const resolveCurrentDuration = () => {
            const duration = toDurationMs(audio.duration);
            if (duration === undefined) return false;

            finish(duration);
            return true;
        };

        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
            if (resolveCurrentDuration()) return;

            if (audio.duration !== Infinity) {
                finish(undefined);
                return;
            }

            audio.ondurationchange = () => {
                resolveCurrentDuration();
            };
            audio.onseeked = () => {
                resolveCurrentDuration();
            };
            fallbackTimeout = scheduleTimeout(() => {
                finish(undefined);
            }, fallbackTimeoutMs);

            try {
                audio.currentTime = AUDIO_DURATION_FALLBACK_SEEK_SECONDS;
            } catch {
                finish(undefined);
            }
        };
        audio.onerror = () => {
            finish(undefined);
        };
        audio.src = objectUrl;
    });
}

export function getAudioDuration(file: File) {
    return getAudioDurationWithDependencies(file, {
        clearTimeout: (timeout) => window.clearTimeout(timeout as number),
        createAudio: () => document.createElement('audio'),
        createObjectUrl: (targetFile) => URL.createObjectURL(targetFile),
        fallbackTimeoutMs: 1500,
        revokeObjectUrl: (objectUrl) => URL.revokeObjectURL(objectUrl),
        setTimeout: (handler, timeout) => window.setTimeout(handler, timeout),
    });
}
