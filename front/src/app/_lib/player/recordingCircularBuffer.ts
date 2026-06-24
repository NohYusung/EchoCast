export const recordingCircularBufferMaxMs = 30000;
export const recordingBufferTailPaddingMs = 400;

export type RecordingBufferSelection = {
    startMs: number;
    durationMs: number;
    endMs: number;
};

export function toRecordingBufferSelection({
    bufferDurationMs,
    targetDurationMs,
    tailPaddingMs = recordingBufferTailPaddingMs,
}: {
    bufferDurationMs: number;
    targetDurationMs: number;
    tailPaddingMs?: number;
}): RecordingBufferSelection {
    const safeBufferDurationMs = Math.max(0, Math.round(toFiniteNumber(bufferDurationMs)));
    if (safeBufferDurationMs <= 0) {
        return { startMs: 0, durationMs: 0, endMs: 0 };
    }

    const safeTargetDurationMs = Math.max(1, Math.round(toFiniteNumber(targetDurationMs) || safeBufferDurationMs));
    const durationMs = Math.min(safeBufferDurationMs, safeTargetDurationMs);
    const maxStartMs = Math.max(0, safeBufferDurationMs - durationMs);
    const preferredStartMs = safeBufferDurationMs - durationMs - Math.max(0, Math.round(toFiniteNumber(tailPaddingMs)));
    const startMs = clampInteger(preferredStartMs, 0, maxStartMs);

    return {
        startMs,
        durationMs,
        endMs: startMs + durationMs,
    };
}

export function moveRecordingBufferSelection({
    bufferDurationMs,
    selectionDurationMs,
    startRatio,
}: {
    bufferDurationMs: number;
    selectionDurationMs: number;
    startRatio: number;
}): RecordingBufferSelection {
    const safeBufferDurationMs = Math.max(0, Math.round(toFiniteNumber(bufferDurationMs)));
    const durationMs = Math.min(safeBufferDurationMs, Math.max(0, Math.round(toFiniteNumber(selectionDurationMs))));
    if (safeBufferDurationMs <= 0 || durationMs <= 0) {
        return { startMs: 0, durationMs: 0, endMs: 0 };
    }

    const maxStartMs = Math.max(0, safeBufferDurationMs - durationMs);
    const startMs = clampInteger(Math.round(toFiniteNumber(startRatio) * safeBufferDurationMs), 0, maxStartMs);

    return {
        startMs,
        durationMs,
        endMs: startMs + durationMs,
    };
}

export function getRecordingBufferWindowStyle(selection: RecordingBufferSelection, bufferDurationMs: number) {
    const safeBufferDurationMs = Math.max(0, toFiniteNumber(bufferDurationMs));
    if (safeBufferDurationMs <= 0) {
        return { leftPercent: 0, widthPercent: 0 };
    }

    return {
        leftPercent: (Math.max(0, selection.startMs) / safeBufferDurationMs) * 100,
        widthPercent: (Math.max(0, selection.durationMs) / safeBufferDurationMs) * 100,
    };
}

export function concatRecordingBufferChunks(chunks: readonly Float32Array[]): Float32Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const samples = new Float32Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
    }

    return samples;
}

export function trimRecordingBufferChunks({
    chunks,
    totalSamples,
    maxSamples,
}: {
    chunks: Float32Array[];
    totalSamples: number;
    maxSamples: number;
}) {
    let nextTotalSamples = totalSamples;

    while (chunks.length > 0 && nextTotalSamples - chunks[0].length >= maxSamples) {
        nextTotalSamples -= chunks.shift()?.length ?? 0;
    }

    if (chunks.length > 0 && nextTotalSamples > maxSamples) {
        const trimSamples = nextTotalSamples - maxSamples;
        chunks[0] = chunks[0].slice(trimSamples);
        nextTotalSamples = maxSamples;
    }

    return nextTotalSamples;
}

export function getRecordingBufferDurationMs(sampleCount: number, sampleRate: number): number {
    const safeSampleRate = Math.max(1, toFiniteNumber(sampleRate));
    return Math.round((Math.max(0, sampleCount) / safeSampleRate) * 1000);
}

export function buildRecordingBufferWaveformPeaks(samples: Float32Array, count: number): number[] {
    const barCount = Math.max(0, Math.round(count));
    if (barCount <= 0) return [];
    if (samples.length === 0) return Array.from({ length: barCount }, () => 10);

    return Array.from({ length: barCount }, (_, index) => {
        const start = Math.floor((index / barCount) * samples.length);
        const end = Math.max(start + 1, Math.floor(((index + 1) / barCount) * samples.length));
        let peak = 0;

        for (let sampleIndex = start; sampleIndex < end && sampleIndex < samples.length; sampleIndex += 1) {
            peak = Math.max(peak, Math.abs(samples[sampleIndex]));
        }

        return Math.round(10 + Math.min(1, peak) * 86);
    });
}

export function buildRecordingBufferSelectionWaveformPeaks({
    samples,
    sampleRate,
    selection,
    count,
}: {
    samples: Float32Array;
    sampleRate: number;
    selection: RecordingBufferSelection;
    count: number;
}): number[] {
    const safeSampleRate = Math.max(1, toFiniteNumber(sampleRate));
    const startSample = clampInteger(Math.floor((Math.max(0, selection.startMs) / 1000) * safeSampleRate), 0, samples.length);
    const endSample = clampInteger(Math.ceil((Math.max(0, selection.endMs) / 1000) * safeSampleRate), startSample, samples.length);

    return buildRecordingBufferWaveformPeaks(samples.slice(startSample, endSample), count);
}

export function encodePcm16Wav(samples: Float32Array, sampleRate: number): Blob {
    const safeSampleRate = Math.max(1, Math.round(toFiniteNumber(sampleRate) || 48000));
    const bytesPerSample = 2;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, safeSampleRate, true);
    view.setUint32(28, safeSampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (const sample of samples) {
        const clampedSample = Math.max(-1, Math.min(1, sample));
        const pcmSample = clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff;
        view.setInt16(offset, Math.round(pcmSample), true);
        offset += bytesPerSample;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

function toFiniteNumber(value: number): number {
    return Number.isFinite(value) ? value : 0;
}

function clampInteger(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.round(value)));
}

function writeAscii(view: DataView, offset: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
    }
}
