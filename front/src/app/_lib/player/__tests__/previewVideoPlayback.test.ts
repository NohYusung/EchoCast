import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syncPreviewVideoPlayback } from '../previewVideoPlayback';

function createVideoDouble(currentTime = 0, paused = true) {
    return {
        currentTime,
        muted: false,
        paused,
        volume: 1,
        playCalls: 0,
        pauseCalls: 0,
        play() {
            this.playCalls += 1;
            this.paused = false;
            return Promise.resolve();
        },
        pause() {
            this.pauseCalls += 1;
            this.paused = true;
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
    assert.equal(secondVideo.pauseCalls, 0);
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
    const video = createVideoDouble(0, false);

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

test('syncPreviewVideoPlayback does not replay or repause videos already in the right state', () => {
    const activeVideo = createVideoDouble(2.4, false);
    const inactiveVideo = createVideoDouble(0, true);

    syncPreviewVideoPlayback({
        clips: [
            { id: 'video-1', mediaType: 'video', start: 10, duration: 10 },
            { id: 'video-2', mediaType: 'video', start: 30, duration: 10 },
        ],
        isPlaying: true,
        playhead: 12.5,
        videos: new Map([
            ['video-1', activeVideo],
            ['video-2', inactiveVideo],
        ]),
    });

    assert.equal(activeVideo.currentTime, 2.4);
    assert.equal(activeVideo.playCalls, 0);
    assert.equal(activeVideo.pauseCalls, 0);
    assert.equal(inactiveVideo.playCalls, 0);
    assert.equal(inactiveVideo.pauseCalls, 0);
});

test('syncPreviewVideoPlayback avoids repeated seeks while the preview playhead advances smoothly', () => {
    const video = createVideoDouble();
    const clips = [{ id: 'video-1', mediaType: 'video', start: 10, duration: 10 }];
    const videos = new Map([['video-1', video]]);

    syncPreviewVideoPlayback({
        clips,
        isPlaying: true,
        playhead: 12.4,
        videos,
    });
    syncPreviewVideoPlayback({
        clips,
        isPlaying: true,
        playhead: 12.7,
        videos,
    });

    assert.equal(video.currentTime, 2.4);
    assert.equal(video.playCalls, 1);
});

test('syncPreviewVideoPlayback does not chase a lagging video during smooth player playback', () => {
    const video = createVideoDouble();
    const clips = [{ id: 'video-1', mediaType: 'video', start: 10, duration: 10 }];
    const videos = new Map([['video-1', video]]);

    syncPreviewVideoPlayback({
        clips,
        isPlaying: true,
        playhead: 12.4,
        videos,
    });

    for (const playhead of [12.7, 13, 13.3, 13.6, 13.9, 14.1]) {
        syncPreviewVideoPlayback({
            clips,
            isPlaying: true,
            playhead,
            videos,
        });
    }

    assert.equal(video.currentTime, 2.4);
    assert.equal(video.playCalls, 1);
});

test('syncPreviewVideoPlayback still seeks when the preview playhead jumps', () => {
    const video = createVideoDouble();
    const clips = [{ id: 'video-1', mediaType: 'video', start: 10, duration: 10 }];
    const videos = new Map([['video-1', video]]);

    syncPreviewVideoPlayback({
        clips,
        isPlaying: true,
        playhead: 12.4,
        videos,
    });
    syncPreviewVideoPlayback({
        clips,
        isPlaying: true,
        playhead: 16,
        videos,
    });

    assert.equal(video.currentTime, 6);
    assert.equal(video.playCalls, 1);
});
