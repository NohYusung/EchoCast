export type UploadableMediaType = 'image' | 'video';

export type MediaUploadFailure = {
    fileName: string;
    error: string;
};

export type MediaUploadQueueItem<TFile> = {
    file: TFile;
    fileName: string;
    mediaType: UploadableMediaType;
    key: string;
};

export type MediaRegistrationRequest = {
    mediaName: string;
    mediaType: UploadableMediaType;
    mediaUrl: string;
    duration?: number;
};

export type FileUploadUrlRequest = {
    key: string;
    contentType: string;
};

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
    aac: 'audio/aac',
    avif: 'image/avif',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    m4a: 'audio/mp4',
    m4v: 'video/mp4',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    ogg: 'audio/ogg',
    png: 'image/png',
    wav: 'audio/wav',
    webm: 'video/webm',
    webp: 'image/webp',
};

export function buildMediaUploadQueue<TFile extends { name: string }>({
    episodeId,
    files,
    getMediaType,
    getUploadKey,
}: {
    episodeId: string;
    files: readonly TFile[];
    getMediaType: (file: TFile) => UploadableMediaType | null;
    getUploadKey: (episodeId: string, file: TFile, mediaType: UploadableMediaType) => string;
}) {
    const items: Array<MediaUploadQueueItem<TFile>> = [];
    const failures: MediaUploadFailure[] = [];

    files.forEach((file) => {
        const mediaType = getMediaType(file);

        if (!mediaType) {
            failures.push({
                fileName: file.name,
                error: '이미지 또는 영상 파일만 등록할 수 있습니다.',
            });
            return;
        }

        items.push({
            file,
            fileName: file.name,
            mediaType,
            key: getUploadKey(episodeId, file, mediaType),
        });
    });

    return { items, failures };
}

export function getUploadContentType(file: { name: string; type?: string | null }) {
    const browserContentType = file.type?.trim();

    if (browserContentType) {
        return browserContentType;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();

    if (!extension) {
        return 'application/octet-stream';
    }

    return EXTENSION_CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

export function buildFileUploadUrlRequests<TFile extends { name: string; type?: string | null }>(
    items: ReadonlyArray<Pick<MediaUploadQueueItem<TFile>, 'file' | 'key'>>
): FileUploadUrlRequest[] {
    return items.map((item) => ({
        key: item.key,
        contentType: getUploadContentType(item.file),
    }));
}

export function buildMediaRegistrationRequest<TFile>({
    duration,
    item,
    mediaUrl,
}: {
    duration?: number;
    item: Pick<MediaUploadQueueItem<TFile>, 'fileName' | 'mediaType'>;
    mediaUrl: string;
}): MediaRegistrationRequest {
    return {
        mediaName: item.fileName,
        mediaType: item.mediaType,
        mediaUrl,
        ...(item.mediaType === 'video' && typeof duration === 'number' ? { duration } : {}),
    };
}

export async function uploadFileToPresignedUrl(presignedUrl: string, file: Blob, contentType: string) {
    const response = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': contentType,
        },
        body: file,
    });

    if (!response.ok) {
        throw new Error(`File upload failed: ${response.status}`);
    }
}

export function toMediaUploadFailureMessage(failures: readonly MediaUploadFailure[]) {
    if (failures.length === 0) {
        return undefined;
    }

    return `등록 실패: ${failures.map((failure) => failure.fileName).join(', ')}`;
}
