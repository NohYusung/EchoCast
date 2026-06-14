import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    audioBufferToWavFile,
    getAudioUploadCandidateKind,
    getExtractedAudioFileName,
    prepareAudioUploadFile,
} from '../audioFileExtraction';

function readAscii(view: DataView, offset: number, length: number) {
    return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join('');
}

const decodedAudioBuffer = {
    duration: 0.25,
    length: 2,
    numberOfChannels: 2,
    sampleRate: 8000,
    getChannelData: (channel: number) =>
        channel === 0 ? Float32Array.from([0, 0.5]) : Float32Array.from([1, -1]),
};

test('getAudioUploadCandidateKind accepts audio files and mp4 videos only', () => {
    assert.equal(getAudioUploadCandidateKind(new File(['audio'], 'voice.mp3', { type: 'audio/mpeg' })), 'audio');
    assert.equal(getAudioUploadCandidateKind(new File(['video'], 'scene.mp4', { type: 'video/mp4' })), 'mp4-video');
    assert.equal(getAudioUploadCandidateKind(new File(['video'], 'scene.mov', { type: 'video/quicktime' })), null);
});

test('getExtractedAudioFileName appends audio wav suffix', () => {
    assert.equal(getExtractedAudioFileName('scene.mp4'), 'scene-audio.wav');
    assert.equal(getExtractedAudioFileName('scene.with.dots.mp4'), 'scene.with.dots-audio.wav');
});

test('audioBufferToWavFile encodes a 16-bit PCM wav file', async () => {
    const wavFile = audioBufferToWavFile(decodedAudioBuffer, 'scene-audio.wav');
    const wavBytes = await wavFile.arrayBuffer();
    const view = new DataView(wavBytes);

    assert.equal(wavFile.name, 'scene-audio.wav');
    assert.equal(wavFile.type, 'audio/wav');
    assert.equal(readAscii(view, 0, 4), 'RIFF');
    assert.equal(readAscii(view, 8, 4), 'WAVE');
    assert.equal(readAscii(view, 12, 4), 'fmt ');
    assert.equal(readAscii(view, 36, 4), 'data');
    assert.equal(view.getUint16(22, true), 2);
    assert.equal(view.getUint32(24, true), 8000);
    assert.equal(view.getUint32(40, true), 8);
    assert.equal(view.getInt16(44, true), 0);
    assert.equal(view.getInt16(46, true), 32767);
    assert.equal(view.getInt16(48, true), 16383);
    assert.equal(view.getInt16(50, true), -32768);
});

test('prepareAudioUploadFile decodes mp4 audio into a wav upload file', async () => {
    const sourceFile = new File(['mp4'], 'scene.mp4', { type: 'video/mp4' });
    let didCloseAudioContext = false;
    const preparedUpload = await prepareAudioUploadFile(sourceFile, {
        createAudioContext: () => ({
            close: () => {
                didCloseAudioContext = true;
            },
            decodeAudioData: async (audioData) => {
                assert.equal(audioData.byteLength, 3);
                return decodedAudioBuffer;
            },
        }),
    });

    assert.equal(preparedUpload?.file.name, 'scene-audio.wav');
    assert.equal(preparedUpload?.duration, 250);
    assert.equal(preparedUpload?.sourceFileName, 'scene.mp4');
    assert.equal(preparedUpload?.wasExtractedFromVideo, true);
    assert.equal(didCloseAudioContext, true);
});
