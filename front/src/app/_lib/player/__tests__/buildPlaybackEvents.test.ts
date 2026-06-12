import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPlaybackEvents } from '../buildPlaybackEvents';
import { sampleManifest } from '../sampleManifest';

test('buildPlaybackEvents schedules cue records before tts fallback for the same cue', () => {
    const events = buildPlaybackEvents(sampleManifest);
    const recordEvent = events.find((event) => event.sourceId === 'record-5001');
    const ttsEvent = events.find((event) => event.sourceId === 'tts-5001');

    assert.equal(recordEvent?.kind, 'record');
    assert.equal(ttsEvent, undefined);
});

test('buildPlaybackEvents schedules tts fallback when a cue has no record', () => {
    const events = buildPlaybackEvents(sampleManifest);
    const fallbackEvent = events.find((event) => event.sourceId === 'tts-5002');

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
                id: 'audio-item-1',
                trackId: 'track-audio',
                kind: 'audio',
                startTime: 1000,
                endTime: 5000,
                mediaId: 'audio-1',
                layerId: 2,
                volume: 0.6,
            },
        ],
        media: [
            {
                id: 'audio-1',
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
            id: 'audio-event-audio-item-1',
            cueId: 'audio-item-1',
            kind: 'audio',
            sourceId: 'audio-1',
            url: 'https://assets.example.com/opening.mp3',
            startTime: 1000,
            endTime: 5000,
            volume: 0.6,
        },
    ]);
});
