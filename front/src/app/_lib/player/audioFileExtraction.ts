type DecodedAudioBuffer = {
    duration: number;
    length: number;
    numberOfChannels: number;
    sampleRate: number;
    getChannelData: (channel: number) => Float32Array;
};

type AudioContextLike = {
    close?: () => Promise<void> | void;
    decodeAudioData: (audioData: ArrayBuffer) => Promise<DecodedAudioBuffer>;
};

type AudioExtractionDependencies = {
    createAudioContext: () => AudioContextLike;
};

type PreparedAudioUpload = {
    file: File;
    name: string;
    duration?: number;
    sourceFileName: string;
    wasExtractedFromVideo: boolean;
};

function getFileExtension(fileName: string) {
    return fileName.split('.').filter(Boolean).pop()?.toLowerCase();
}

function getBaseFileName(fileName: string) {
    const extension = getFileExtension(fileName);

    if (!extension) {
        return fileName.trim() || 'video';
    }

    return fileName.slice(0, -(extension.length + 1)).trim() || 'video';
}

export function getAudioUploadCandidateKind(file: File): 'audio' | 'mp4-video' | null {
    if (file.type.startsWith('audio/')) return 'audio';

    const extension = getFileExtension(file.name);

    if (extension && ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'webm'].includes(extension)) return 'audio';
    if (file.type === 'video/mp4' || extension === 'mp4') return 'mp4-video';

    return null;
}

export function getExtractedAudioFileName(fileName: string) {
    return `${getBaseFileName(fileName)}-audio.wav`;
}

function writeAscii(view: DataView, offset: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
    }
}

export function audioBufferToWavFile(audioBuffer: DecodedAudioBuffer, fileName: string) {
    const channelCount = Math.max(1, audioBuffer.numberOfChannels);
    const frameCount = Math.max(0, audioBuffer.length);
    const bytesPerSample = 2;
    const blockAlign = channelCount * bytesPerSample;
    const dataByteLength = frameCount * blockAlign;
    const output = new ArrayBuffer(44 + dataByteLength);
    const view = new DataView(output);
    const channelData = Array.from({ length: channelCount }, (_, channel) => audioBuffer.getChannelData(channel));
    let offset = 0;

    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataByteLength, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channelCount, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, dataByteLength, true);
    offset = 44;

    for (let frame = 0; frame < frameCount; frame += 1) {
        for (let channel = 0; channel < channelCount; channel += 1) {
            const sample = Math.max(-1, Math.min(1, channelData[channel][frame] ?? 0));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += bytesPerSample;
        }
    }

    return new File([output], fileName, { type: 'audio/wav' });
}

export async function prepareAudioUploadFile(file: File, dependencies?: AudioExtractionDependencies): Promise<PreparedAudioUpload | null> {
    const candidateKind = getAudioUploadCandidateKind(file);

    if (candidateKind === 'audio') {
        return {
            file,
            name: file.name,
            sourceFileName: file.name,
            wasExtractedFromVideo: false,
        };
    }
    if (candidateKind !== 'mp4-video') {
        return null;
    }

    const createAudioContext =
        dependencies?.createAudioContext ??
        (() => {
            const AudioContextConstructor =
                window.AudioContext ??
                (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

            if (!AudioContextConstructor) {
                throw new Error('이 브라우저는 MP4 음성 추출을 지원하지 않습니다.');
            }

            return new AudioContextConstructor();
        });
    const audioContext = createAudioContext();

    try {
        const audioBuffer = await audioContext.decodeAudioData(await file.arrayBuffer());

        if (!Number.isFinite(audioBuffer.duration) || audioBuffer.duration <= 0) {
            throw new Error('MP4 파일에서 오디오 트랙을 찾을 수 없습니다.');
        }

        const extractedFile = audioBufferToWavFile(audioBuffer, getExtractedAudioFileName(file.name));

        return {
            file: extractedFile,
            name: extractedFile.name,
            duration: Math.round(audioBuffer.duration * 1000),
            sourceFileName: file.name,
            wasExtractedFromVideo: true,
        };
    } catch (error) {
        throw new Error(
            error instanceof Error && error.message
                ? error.message
                : 'MP4 파일에서 음성을 추출하지 못했습니다.'
        );
    } finally {
        await audioContext.close?.();
    }
}
