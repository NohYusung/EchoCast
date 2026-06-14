import assert from 'node:assert/strict';
import test from 'node:test';
import {
    stopStudioTimelineAudioPlayback,
    syncStudioTimelineAudioPlayback,
    type StudioTimelineAudioElement,
    type StudioTimelineAudioState,
} from '../studioTimelineAudioPlayback';

class FakeTimelineAudio implements StudioTimelineAudioElement {
    currentTime = 0;
    paused = true;
    pauseCalls = 0;
    playCalls = 0;
    volume = 1;

    play() {
        this.paused = false;
        this.playCalls += 1;
        return Promise.resolve();
    }

    pause() {
        this.paused = true;
        this.pauseCalls += 1;
    }
}

test('syncStudioTimelineAudioPlayback plays an active audio clip at the playhead offset', () => {
    const audioByClipId: StudioTimelineAudioState = new Map();
    const createdAudios: FakeTimelineAudio[] = [];

    syncStudioTimelineAudioPlayback({
        audioByClipId,
        clips: [
            {
                id: 'cue-1',
                track: 'bgm-track',
                start: 5,
                duration: 10,
                audioUrl: 'https://assets.example.com/bgm.mp3',
                volume: 0.42,
            },
        ],
        createAudio: () => {
            const audio = new FakeTimelineAudio();
            createdAudios.push(audio);
            return audio;
        },
        isPlaying: true,
        mutedTrackIds: [],
        playhead: 8,
        soloTrackIds: [],
    });

    assert.equal(createdAudios.length, 1);
    assert.equal(createdAudios[0].playCalls, 1);
    assert.equal(createdAudios[0].paused, false);
    assert.equal(createdAudios[0].currentTime, 3);
    assert.equal(createdAudios[0].volume, 0.42);
});

test('syncStudioTimelineAudioPlayback seeks from the cue source audio offset', () => {
    const audioByClipId: StudioTimelineAudioState = new Map();
    const createdAudios: FakeTimelineAudio[] = [];

    syncStudioTimelineAudioPlayback({
        audioByClipId,
        clips: [
            {
                id: 'cue-2',
                track: 'voice-track',
                start: 12,
                duration: 4,
                audioStart: 30,
                audioEnd: 34,
                audioUrl: 'https://assets.example.com/voice.wav',
            },
        ],
        createAudio: () => {
            const audio = new FakeTimelineAudio();
            createdAudios.push(audio);
            return audio;
        },
        isPlaying: true,
        mutedTrackIds: [],
        playhead: 13.25,
        soloTrackIds: [],
    });

    assert.equal(createdAudios.length, 1);
    assert.equal(createdAudios[0].currentTime, 31.25);
    assert.equal(createdAudios[0].paused, false);
});

test('syncStudioTimelineAudioPlayback pauses clips on muted or non-solo tracks', () => {
    const audio = new FakeTimelineAudio();
    audio.paused = false;
    audio.currentTime = 4;
    const audioByClipId: StudioTimelineAudioState = new Map([
        ['cue-1', { audio, url: 'https://assets.example.com/bgm.mp3' }],
    ]);

    syncStudioTimelineAudioPlayback({
        audioByClipId,
        clips: [
            {
                id: 'cue-1',
                track: 'bgm-track',
                start: 0,
                duration: 10,
                audioUrl: 'https://assets.example.com/bgm.mp3',
            },
        ],
        createAudio: () => new FakeTimelineAudio(),
        isPlaying: true,
        mutedTrackIds: ['bgm-track'],
        playhead: 2,
        soloTrackIds: [],
    });

    assert.equal(audio.pauseCalls, 1);
    assert.equal(audio.paused, true);
    assert.equal(audio.currentTime, 0);

    audio.paused = false;
    audio.currentTime = 3;

    syncStudioTimelineAudioPlayback({
        audioByClipId,
        clips: [
            {
                id: 'cue-1',
                track: 'bgm-track',
                start: 0,
                duration: 10,
                audioUrl: 'https://assets.example.com/bgm.mp3',
            },
        ],
        createAudio: () => new FakeTimelineAudio(),
        isPlaying: true,
        mutedTrackIds: [],
        playhead: 2,
        soloTrackIds: ['voice-track'],
    });

    assert.equal(audio.pauseCalls, 2);
    assert.equal(audio.currentTime, 0);
});

test('stopStudioTimelineAudioPlayback pauses and clears managed audio entries', () => {
    const audio = new FakeTimelineAudio();
    audio.paused = false;
    audio.currentTime = 5;
    const audioByClipId: StudioTimelineAudioState = new Map([
        ['cue-1', { audio, url: 'https://assets.example.com/bgm.mp3' }],
    ]);

    stopStudioTimelineAudioPlayback(audioByClipId);

    assert.equal(audio.pauseCalls, 1);
    assert.equal(audio.paused, true);
    assert.equal(audio.currentTime, 0);
    assert.equal(audioByClipId.size, 0);
});
