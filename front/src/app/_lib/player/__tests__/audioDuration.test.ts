import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAudioDurationWithDependencies } from '../audioDuration';

class FakeAudioElement {
    preload = '';
    duration = Infinity;
    ondurationchange: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onloadedmetadata: (() => void) | null = null;
    onseeked: (() => void) | null = null;
    src = '';
    private nextDuration: number;
    private time = 0;

    constructor(nextDuration: number) {
        this.nextDuration = nextDuration;
    }

    get currentTime() {
        return this.time;
    }

    set currentTime(value: number) {
        this.time = value;
        this.duration = this.nextDuration;
        this.ondurationchange?.();
        this.onseeked?.();
    }

    load() {}

    removeAttribute(name: string) {
        if (name === 'src') {
            this.src = '';
        }
    }
}

test('getAudioDurationWithDependencies resolves MP3 duration after Infinity metadata fallback', async () => {
    const audio = new FakeAudioElement(12.345);
    const file = new File(['mp3'], 'clip.mp3', { type: 'audio/mpeg' });

    const durationPromise = getAudioDurationWithDependencies(file, {
        clearTimeout: (() => undefined) as unknown as typeof clearTimeout,
        createAudio: () => audio,
        createObjectUrl: () => 'blob:clip',
        fallbackTimeoutMs: 1000,
        revokeObjectUrl: () => undefined,
        setTimeout: (() => 1) as unknown as typeof setTimeout,
    });

    audio.onloadedmetadata?.();

    assert.equal(await durationPromise, 12345);
});

test('getAudioDurationWithDependencies calls timer dependency without an object receiver', async () => {
    const audio = new FakeAudioElement(4.259);
    const file = new File(['mp3'], 'clip.mp3', { type: 'audio/mpeg' });
    let timerReceiver: unknown = 'not-called';

    const dependencies = {
        clearTimeout: (() => undefined) as unknown as typeof clearTimeout,
        createAudio: () => audio,
        createObjectUrl: () => 'blob:clip',
        fallbackTimeoutMs: 1000,
        revokeObjectUrl: () => undefined,
        setTimeout: function (this: unknown) {
            timerReceiver = this;
            return 1;
        } as unknown as typeof setTimeout,
    };
    const durationPromise = getAudioDurationWithDependencies(file, dependencies);

    audio.onloadedmetadata?.();

    assert.notEqual(timerReceiver, dependencies);
    assert.equal(await durationPromise, 4259);
});
