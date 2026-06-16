import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPlaybackEvents } from '../buildPlaybackEvents';
import { sampleManifest } from '../sampleManifest';

test('buildPlaybackEvents schedules cue records before tts fallback for the same cue', () => {
    const events = buildPlaybackEvents(sampleManifest);
    const recordEvent = events.find((event) => event.sourceId === 6001);
    const ttsEvent = events.find((event) => event.sourceId === 7001);

    assert.equal(recordEvent?.kind, 'record');
    assert.equal(ttsEvent, undefined);
});

test('buildPlaybackEvents uses the accepted record when a cue has multiple records', () => {
    const events = buildPlaybackEvents({
        ...sampleManifest,
        records: [
            {
                id: 6101,
                cueId: 5001,
                artistId: 1,
                recordUrl: '/audio/record-5001-draft.wav',
                duration: 2000,
                volume: 1,
                isAccepted: false,
            },
            {
                id: 6102,
                cueId: 5001,
                artistId: 1,
                recordUrl: '/audio/record-5001-accepted.wav',
                duration: 2100,
                volume: 0.8,
                isAccepted: true,
            },
        ],
    });
    const recordEvent = events.find((event) => event.cueId === 5001);

    assert.equal(recordEvent?.sourceId, 6102);
    assert.equal(recordEvent?.url, '/audio/record-5001-accepted.wav');
    assert.equal(recordEvent?.volume, 0.8);
});

test('buildPlaybackEvents ignores unaccepted records and falls back to tts', () => {
    const events = buildPlaybackEvents({
        ...sampleManifest,
        records: [
            {
                id: 6202,
                cueId: 5002,
                artistId: 1,
                recordUrl: '/audio/record-5002-draft.wav',
                duration: 2100,
                volume: 1,
                isAccepted: false,
            },
        ],
    });
    const draftRecordEvent = events.find((event) => event.sourceId === 6202);
    const fallbackEvent = events.find((event) => event.sourceId === 7002);

    assert.equal(draftRecordEvent, undefined);
    assert.equal(fallbackEvent?.kind, 'tts');
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
