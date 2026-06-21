import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPlaybackEvents } from '../buildPlaybackEvents';
import { sampleManifest } from '../sampleManifest';

test('buildPlaybackEvents schedules cue audio before tts fallback for the same cue', () => {
    const events = buildPlaybackEvents(sampleManifest);
    const recordEvent = events.find((event) => event.cueId === 5001);
    const ttsEvent = events.find((event) => event.sourceId === 7001);

    assert.equal(recordEvent?.kind, 'audio');
    assert.equal(recordEvent?.sourceId, 6001);
    assert.equal(recordEvent?.url, '/audio/record-5001.wav');
    assert.equal(ttsEvent, undefined);
});

test('buildPlaybackEvents uses cue audioId instead of accepted records when cue has audio', () => {
    const events = buildPlaybackEvents({
        ...sampleManifest,
        items: [
            {
                id: 5001,
                trackId: 2,
                kind: 'audio',
                startTime: 0,
                endTime: 2200,
                mediaId: 6102,
                cueId: 5001,
                layerId: 1,
                volume: 1,
            },
        ],
        cues: [
            {
                id: 5001,
                scriptId: 5001,
                characterId: 1,
                trackId: 2,
                audioId: 6102,
                startTime: 0,
                endTime: 2200,
                volume: 1,
            },
        ],
        media: [
            {
                id: 6102,
                kind: 'audio',
                url: '/audio/record-5001-accepted.wav',
                durationMs: 2100,
            },
        ],
        records: [
            {
                id: 6101,
                cueId: 5001,
                artistId: 1,
                audioId: 6101,
                recordUrl: '/audio/record-5001-draft.wav',
                duration: 2000,
                isAccepted: false,
            },
            {
                id: 6102,
                cueId: 5001,
                artistId: 1,
                audioId: 6102,
                recordUrl: '/audio/record-5001-accepted.wav',
                duration: 2100,
                isAccepted: true,
            },
        ],
        tts: [],
    });
    const cueAudioEvent = events.find((event) => event.cueId === 5001);

    assert.equal(events.length, 1);
    assert.equal(cueAudioEvent?.kind, 'audio');
    assert.equal(cueAudioEvent?.sourceId, 6102);
    assert.equal(cueAudioEvent?.url, '/audio/record-5001-accepted.wav');
    assert.equal(cueAudioEvent?.volume, 1);
});

test('buildPlaybackEvents ignores unaccepted records and falls back to tts', () => {
    const events = buildPlaybackEvents({
        ...sampleManifest,
        records: [
            {
                id: 6202,
                cueId: 5002,
                artistId: 1,
                audioId: 6202,
                recordUrl: '/audio/record-5002-draft.wav',
                duration: 2100,
                isAccepted: false,
            },
        ],
    });
    const draftRecordEvent = events.find((event) => event.sourceId === 6202);
    const fallbackEvent = events.find((event) => event.sourceId === 7002);

    assert.equal(draftRecordEvent, undefined);
    assert.equal(fallbackEvent?.kind, 'tts');
});

test('buildPlaybackEvents does not play accepted records without cue audioId', () => {
    const events = buildPlaybackEvents({
        ...sampleManifest,
        items: [],
        cues: [
            {
                id: 5001,
                scriptId: 5001,
                characterId: 1,
                trackId: 2,
                startTime: 0,
                endTime: 2200,
                volume: 1,
            },
        ],
        records: [
            {
                id: 6102,
                cueId: 5001,
                artistId: 1,
                audioId: 6102,
                recordUrl: '/audio/record-5001-accepted.wav',
                duration: 2100,
                isAccepted: true,
            },
        ],
        tts: [],
    });

    assert.deepEqual(events, []);
});

test('buildPlaybackEvents schedules tts fallback when a cue has no record', () => {
    const events = buildPlaybackEvents(sampleManifest);
    const fallbackEvent = events.find((event) => event.sourceId === 7002);

    assert.equal(fallbackEvent?.kind, 'tts');
    assert.equal(fallbackEvent?.startTime, 2600);
});

test('buildPlaybackEvents returns events in timeline order', () => {
    const events = buildPlaybackEvents(sampleManifest);
    const times = events.map((event) => event.startTime);

    assert.deepEqual(
        times,
        [...times].sort((a, b) => a - b)
    );
});

test('buildPlaybackEvents schedules audio timeline items from manifest media', () => {
    const events = buildPlaybackEvents({
        ...sampleManifest,
        items: [
            {
                id: 8001,
                trackId: 3,
                kind: 'audio',
                startTime: 1000,
                endTime: 5000,
                mediaId: 3001,
                layerId: 2,
                volume: 0.6,
            },
        ],
        media: [
            {
                id: 3001,
                kind: 'audio',
                url: 'https://assets.example.com/opening.mp3',
                durationMs: 4000,
            },
        ],
        cues: [],
        records: [],
        tts: [],
    });

    assert.deepEqual(events, [
        {
            id: 'audio-event-8001',
            cueId: 8001,
            kind: 'audio',
            sourceId: 3001,
            url: 'https://assets.example.com/opening.mp3',
            startTime: 1000,
            endTime: 5000,
            sourceStartTime: 0,
            volume: 0.6,
        },
    ]);
});

test('buildPlaybackEvents carries audio trim start into playback events', () => {
    const events = buildPlaybackEvents({
        ...sampleManifest,
        items: [
            {
                id: 8002,
                trackId: 3,
                kind: 'audio',
                startTime: 1000,
                endTime: 5000,
                mediaId: 3001,
                trimStartTime: 2000,
                trimEndTime: 6000,
                layerId: 2,
                volume: 0.6,
            },
        ],
        media: [
            {
                id: 3001,
                kind: 'audio',
                url: 'https://assets.example.com/opening.mp3',
                durationMs: 8000,
            },
        ],
        cues: [],
        records: [],
        tts: [],
    });

    assert.equal(events[0]?.sourceStartTime, 2000);
});
