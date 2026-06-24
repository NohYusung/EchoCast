import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildRecordingBufferSelectionWaveformPeaks,
    buildRecordingBufferWaveformPeaks,
    encodePcm16Wav,
    moveRecordingBufferSelection,
    padRecordingSamplesWithSilence,
    recordingSilencePaddingMs,
    toRecordingBufferSelection,
} from '../recordingCircularBuffer';

test('recording buffer starts the cue-duration window after two seconds of silence', () => {
    const selection = toRecordingBufferSelection({
        bufferDurationMs: 9000,
        targetDurationMs: 5000,
        startMs: recordingSilencePaddingMs,
    });

    assert.equal(recordingSilencePaddingMs, 2000);
    assert.deepEqual(selection, {
        startMs: 2000,
        durationMs: 5000,
        endMs: 7000,
    });
});

test('recording buffer selection is clamped when the cue is longer than the buffer', () => {
    const selection = toRecordingBufferSelection({
        bufferDurationMs: 1200,
        targetDurationMs: 3000,
    });

    assert.deepEqual(selection, {
        startMs: 0,
        durationMs: 1200,
        endMs: 1200,
    });
});

test('recording buffer selection dragging stays inside the retained buffer', () => {
    assert.deepEqual(
        moveRecordingBufferSelection({
            bufferDurationMs: 5000,
            selectionDurationMs: 1000,
            startRatio: -0.25,
        }),
        { startMs: 0, durationMs: 1000, endMs: 1000 },
    );
    assert.deepEqual(
        moveRecordingBufferSelection({
            bufferDurationMs: 5000,
            selectionDurationMs: 1000,
            startRatio: 0.92,
        }),
        { startMs: 4000, durationMs: 1000, endMs: 5000 },
    );
});

test('recording buffer adds silence before and after the fixed recording duration', () => {
    const padded = padRecordingSamplesWithSilence({
        samples: Float32Array.from([0.25, -0.5, 0.75]),
        sampleRate: 1000,
        targetDurationMs: 5,
        paddingMs: 2,
    });

    assert.equal(padded.durationMs, 9);
    assert.equal(padded.audioStartTime, 2);
    assert.equal(padded.audioEndTime, 7);
    assert.deepEqual(Array.from(padded.samples), [0, 0, 0.25, -0.5, 0.75, 0, 0, 0, 0]);
});

test('recording buffer trims recorded samples to the fixed recording duration before padding', () => {
    const padded = padRecordingSamplesWithSilence({
        samples: Float32Array.from([0.125, 0.25, 0.5, 0.75]),
        sampleRate: 1000,
        targetDurationMs: 2,
        paddingMs: 1,
    });

    assert.equal(padded.durationMs, 4);
    assert.deepEqual(Array.from(padded.samples), [0, 0.125, 0.25, 0]);
});

test('recording buffer waveform peaks are stable and bounded', () => {
    const samples = Float32Array.from([0, 0.4, -0.6, 0.2, 1, -1, 0.1, 0]);
    const peaks = buildRecordingBufferWaveformPeaks(samples, 4);

    assert.equal(peaks.length, 4);
    assert.ok(peaks.every((height) => height >= 10 && height <= 96));
    assert.deepEqual(peaks, buildRecordingBufferWaveformPeaks(samples, 4));
});

test('recording buffer selection waveform follows the dragged save window', () => {
    const samples = Float32Array.from([0.1, 0.1, 0.1, 0.1, 0.9, 0.9, 0.9, 0.9]);
    const leftSelection = { startMs: 0, durationMs: 4, endMs: 4 };
    const rightSelection = { startMs: 4, durationMs: 4, endMs: 8 };

    const leftWave = buildRecordingBufferSelectionWaveformPeaks({
        samples,
        sampleRate: 1000,
        selection: leftSelection,
        count: 4,
    });
    const rightWave = buildRecordingBufferSelectionWaveformPeaks({
        samples,
        sampleRate: 1000,
        selection: rightSelection,
        count: 4,
    });

    assert.deepEqual(leftWave, buildRecordingBufferWaveformPeaks(samples.slice(0, 4), 4));
    assert.deepEqual(rightWave, buildRecordingBufferWaveformPeaks(samples.slice(4, 8), 4));
    assert.notDeepEqual(leftWave, rightWave);
});

test('recording buffer saves PCM samples as a wav blob', async () => {
    const wav = encodePcm16Wav(Float32Array.from([0, 0.5, -0.5, 1, -1]), 48000);
    const bytes = new Uint8Array(await wav.arrayBuffer());

    assert.equal(wav.type, 'audio/wav');
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'RIFF');
    assert.equal(String.fromCharCode(...bytes.slice(8, 12)), 'WAVE');
    assert.ok(bytes.byteLength > 44);
});
