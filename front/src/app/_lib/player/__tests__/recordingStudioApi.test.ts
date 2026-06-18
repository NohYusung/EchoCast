import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    buildRecordCreateRequest,
    buildRecordingUploadFileRequest,
    getRecordApiId,
    getRecordingFileExtension,
} from '../recordingStudioApi';

test('getRecordingFileExtension derives a stable extension from recorder mime type', () => {
    assert.equal(getRecordingFileExtension('audio/webm;codecs=opus'), 'webm');
    assert.equal(getRecordingFileExtension('audio/mp4'), 'm4a');
    assert.equal(getRecordingFileExtension('audio/wav'), 'wav');
    assert.equal(getRecordingFileExtension(''), 'webm');
});

test('buildRecordingUploadFileRequest builds an upload key and forwards content type', () => {
    assert.deepEqual(
        buildRecordingUploadFileRequest({
            productId: '1',
            episodeId: '2',
            cueId: 33,
            recordedAtMs: 12345,
            contentType: 'audio/webm;codecs=opus',
        }),
        {
            key: 'products/1/episodes/2/records/33-12345.webm',
            contentType: 'audio/webm;codecs=opus',
        },
    );
});

test('buildRecordCreateRequest maps ids to an unaccepted records API contract by default', () => {
    assert.deepEqual(
        buildRecordCreateRequest({
            cueId: 33,
            artistId: 'artist-7',
            recordUrl: 'https://assets.example.com/record.webm',
            durationMs: 1340,
        }),
        {
            cueId: 33,
            artistId: 7,
            recordUrl: 'https://assets.example.com/record.webm',
            duration: 1340,
            volume: 1,
            isAccepted: false,
        },
    );
});

test('buildRecordCreateRequest preserves an explicit accepted state', () => {
    assert.equal(
        buildRecordCreateRequest({
            cueId: 33,
            artistId: 'artist-7',
            recordUrl: 'https://assets.example.com/record.webm',
            durationMs: 1340,
            isAccepted: true,
        }).isAccepted,
        true,
    );
});

test('getRecordApiId rejects ids without numeric api identity', () => {
    assert.equal(getRecordApiId('cue-local'), undefined);
    assert.equal(getRecordApiId(undefined), undefined);
});
