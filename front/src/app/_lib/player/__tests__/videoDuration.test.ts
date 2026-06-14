import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getVideoDurationWithDependencies } from '../videoDuration';

class FakeVideoElement {
    preload = '';
    duration = 0;
    onerror: (() => void) | null = null;
    onloadedmetadata: (() => void) | null = null;
    src = '';

    load() {}

    removeAttribute(name: string) {
        if (name === 'src') {
            this.src = '';
        }
    }
}

test('getVideoDurationWithDependencies resolves video metadata duration in milliseconds', async () => {
    const video = new FakeVideoElement();
    const file = new File(['mp4'], 'clip.mp4', { type: 'video/mp4' });

    const durationPromise = getVideoDurationWithDependencies(file, {
        createObjectUrl: () => 'blob:clip',
        createVideo: () => video,
        revokeObjectUrl: () => undefined,
    });

    video.duration = 12.345;
    video.onloadedmetadata?.();

    assert.equal(await durationPromise, 12345);
});

test('getVideoDurationWithDependencies returns undefined when metadata duration is unavailable', async () => {
    const video = new FakeVideoElement();
    const file = new File(['mp4'], 'clip.mp4', { type: 'video/mp4' });

    const durationPromise = getVideoDurationWithDependencies(file, {
        createObjectUrl: () => 'blob:clip',
        createVideo: () => video,
        revokeObjectUrl: () => undefined,
    });

    video.duration = Infinity;
    video.onloadedmetadata?.();

    assert.equal(await durationPromise, undefined);
});
