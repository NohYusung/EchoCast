export interface RecordingUploadFileInput {
    productId: string;
    episodeId: string;
    cueId: number;
    recordedAtMs: number;
    contentType: string;
}

export interface RecordingUploadFileRequest {
    key: string;
    contentType: string;
}

export interface RecordCreateInput {
    cueId: number;
    artistId: string;
    recordUrl: string;
    durationMs: number;
    volume?: number;
    isAccepted?: boolean;
}

export interface RecordCreateRequest {
    cueId: number;
    artistId: number;
    recordUrl: string;
    duration: number;
    volume: number;
    isAccepted: boolean;
}

export function getRecordApiId(value?: number | string): number | undefined {
    if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : undefined;
    if (!value) return undefined;

    const direct = Number(value);
    if (Number.isInteger(direct) && direct > 0) return direct;

    const match = value.match(/\d+/);
    if (!match) return undefined;

    const parsed = Number(match[0]);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function getRecordingFileExtension(contentType: string): string {
    const normalized = contentType.split(';')[0]?.trim().toLowerCase();

    if (normalized === 'audio/mp4' || normalized === 'audio/x-m4a') return 'm4a';
    if (normalized === 'audio/mpeg') return 'mp3';
    if (normalized === 'audio/wav' || normalized === 'audio/x-wav' || normalized === 'audio/wave') return 'wav';
    if (normalized === 'audio/ogg') return 'ogg';

    return 'webm';
}

export function buildRecordingUploadFileRequest({
    productId,
    episodeId,
    cueId,
    recordedAtMs,
    contentType,
}: RecordingUploadFileInput): RecordingUploadFileRequest {
    const resolvedContentType = contentType.trim() || 'audio/webm';
    const extension = getRecordingFileExtension(resolvedContentType);

    return {
        key: `products/${sanitizePathSegment(productId)}/episodes/${sanitizePathSegment(episodeId)}/records/${sanitizePathSegment(
            String(cueId),
        )}-${recordedAtMs}.${extension}`,
        contentType: resolvedContentType,
    };
}

export function buildRecordCreateRequest({
    cueId,
    artistId,
    recordUrl,
    durationMs,
    volume = 1,
    isAccepted = false,
}: RecordCreateInput): RecordCreateRequest {
    const cueApiId = getRecordApiId(cueId);
    const artistApiId = getRecordApiId(artistId);

    if (!cueApiId) {
        throw new Error('녹음할 큐의 API ID를 확인할 수 없습니다.');
    }

    if (!artistApiId) {
        throw new Error('성우 API ID를 확인할 수 없습니다.');
    }

    return {
        cueId: cueApiId,
        artistId: artistApiId,
        recordUrl,
        duration: Math.max(0, Math.round(durationMs)),
        volume,
        isAccepted,
    };
}

function sanitizePathSegment(value: string): string {
    const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return normalized || 'unknown';
}
