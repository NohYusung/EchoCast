import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    applyAcceptedRecordsToTimelineClips,
    type RecordPlaybackTimelineClip,
} from '../recordTimelinePlayback';

test('applyAcceptedRecordsToTimelineClips uses accepted record audio for record track cue playback', () => {
    const sourceClips: RecordPlaybackTimelineClip[] = [
        {
            id: 'cue-12',
            track: 'track-record',
            sublabel: 'pos 0% · vol 0.8',
            volume: 0.8,
        },
    ];
    const clips = applyAcceptedRecordsToTimelineClips({
        clips: sourceClips,
        records: [
            {
                id: 90,
                cueId: 12,
                recordUrl: '/records/cue-12.wav',
                duration: 2500,
                isAccepted: true,
            },
        ],
        tracks: [{ id: 'track-record', kind: 'record' }],
    });

    assert.equal(clips[0]?.audioUrl, '/records/cue-12.wav');
    assert.equal(clips[0]?.audioDuration, 2.5);
    assert.equal(clips[0]?.sublabel, 'record 90');
    assert.equal(clips[0]?.volume, 0.8);
});

test('applyAcceptedRecordsToTimelineClips ignores non-record tracks and unaccepted records', () => {
    const sourceClips: RecordPlaybackTimelineClip[] = [
        {
            id: 'cue-12',
            track: 'track-effect',
            audioUrl: '/audios/effect.wav',
            sublabel: 'audio 3 · vol 1',
            volume: 1,
        },
        {
            id: 'cue-13',
            track: 'track-record',
            sublabel: 'pos 0% · vol 1',
            volume: 1,
        },
    ];
    const clips = applyAcceptedRecordsToTimelineClips({
        clips: sourceClips,
        records: [
            {
                id: 91,
                cueId: 13,
                recordUrl: '/records/cue-13-draft.wav',
                duration: 1000,
                isAccepted: false,
            },
        ],
        tracks: [
            { id: 'track-effect', kind: 'effect' },
            { id: 'track-record', kind: 'record' },
        ],
    });

    assert.equal(clips[0]?.audioUrl, '/audios/effect.wav');
    assert.equal(clips[1]?.audioUrl, undefined);
});

test('applyAcceptedRecordsToTimelineClips preserves clip volume for an imported record clip', () => {
    const sourceClips: RecordPlaybackTimelineClip[] = [
        {
            id: 'cue-12',
            track: 'track-record',
            audioUrl: '/records/cue-12.wav',
            sublabel: 'record 90 · vol 0.5',
            volume: 0.4,
        },
    ];
    const clips = applyAcceptedRecordsToTimelineClips({
        clips: sourceClips,
        records: [
            {
                id: 90,
                cueId: 12,
                recordUrl: '/records/cue-12.wav',
                duration: 2500,
                isAccepted: true,
            },
        ],
        tracks: [{ id: 'track-record', kind: 'record' }],
    });

    assert.equal(clips[0]?.volume, 0.4);
});
