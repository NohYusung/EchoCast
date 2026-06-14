import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syncPreviewVideoPlayback } from '../previewVideoPlayback';

function createVideoDouble(currentTime = 0) {
    return {
        currentTime,
        muted: false,
        volume: 1,
        playCalls: 0,
        pauseCalls: 0,
        play() {
            this.playCalls += 1;
            return Promise.resolve();
        },
        pause() {
            this.pauseCalls += 1;
        },
    };
}

test('syncPreviewVideoPlayback plays and seeks the video clip under the preview playhead', () => {
    const firstVideo = createVideoDouble();
    const secondVideo = createVideoDouble();

    syncPreviewVideoPlayback({
        clips: [
            { id: 'image-1', mediaType: 'image', start: 0, duration: 10 },
            { id: 'video-1', mediaType: 'video', start: 10, duration: 5 },
            { id: 'video-2', mediaType: 'video', start: 20, duration: 5 },
        ],
        isPlaying: true,
        playhead: 12.4,
        videos: new Map([
            ['video-1', firstVideo],
            ['video-2', secondVideo],
        ]),
    });

    assert.equal(firstVideo.currentTime, 2.4);
    assert.equal(firstVideo.playCalls, 1);
    assert.equal(firstVideo.pauseCalls, 0);
    assert.equal(secondVideo.playCalls, 0);
    assert.equal(secondVideo.pauseCalls, 1);
});

test('syncPreviewVideoPlayback seeks from the stored video source offset', () => {
    const video = createVideoDouble();

    syncPreviewVideoPlayback({
        clips: [
            {
                id: 'video-1',
                mediaType: 'video',
                start: 10,
                duration: 5,
                sourceStart: 3,
                sourceEnd: 8,
            },
        ],
        isPlaying: true,
        playhead: 12.5,
        videos: new Map([['video-1', video]]),
    });

    assert.equal(video.currentTime, 5.5);
    assert.equal(video.playCalls, 1);
});

test('syncPreviewVideoPlayback applies per clip volume and muted state', () => {
    const video = createVideoDouble();

    syncPreviewVideoPlayback({
        clips: [
            {
                id: 'video-1',
                mediaType: 'video',
                start: 0,
                duration: 5,
                volume: 0.42,
                isMuted: true,
            },
        ],
        isPlaying: true,
        playhead: 1,
        videos: new Map([['video-1', video]]),
    });

    assert.equal(video.volume, 0.42);
    assert.equal(video.muted, true);
    assert.equal(video.playCalls, 1);
});

test('syncPreviewVideoPlayback keeps video active until the stored media duration ends', () => {
    const video = createVideoDouble();

    syncPreviewVideoPlayback({
        clips: [{ id: 'video-1', mediaType: 'video', start: 0, duration: 4, mediaDuration: 12000 }],
        isPlaying: true,
        playhead: 9.5,
        videos: new Map([['video-1', video]]),
    });

    assert.equal(video.currentTime, 9.5);
    assert.equal(video.playCalls, 1);
    assert.equal(video.pauseCalls, 0);
});

test('syncPreviewVideoPlayback pauses the active video when preview playback is stopped', () => {
    const video = createVideoDouble(0);

    syncPreviewVideoPlayback({
        clips: [{ id: 'video-1', mediaType: 'video', start: 10, duration: 5 }],
        isPlaying: false,
        playhead: 12,
        videos: new Map([['video-1', video]]),
    });

    assert.equal(video.currentTime, 2);
    assert.equal(video.playCalls, 0);
    assert.equal(video.pauseCalls, 1);
});
