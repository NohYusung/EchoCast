export type CutEditMediaDetail = {
    label: string;
    value: string;
};

export function getCutEditMediaDetails(media: {
    canvasId?: number;
    index?: number;
    label: string;
    mediaDuration?: number;
    mediaId: number;
    mediaType?: string;
}) {
    const details = [
        { label: '파일명', value: media.label },
        { label: '미디어 ID', value: String(media.mediaId) },
        { label: '캔버스 ID', value: typeof media.canvasId === 'number' ? String(media.canvasId) : '미저장' },
        { label: '캔버스 순서', value: typeof media.index === 'number' ? String(media.index + 1) : '-' },
        { label: '타입', value: media.mediaType ?? '-' },
    ] satisfies CutEditMediaDetail[];

    if (media.mediaType === 'video') {
        details.push({ label: '길이', value: formatMediaDuration(media.mediaDuration) });
    }

    return details;
}

function formatMediaDuration(duration: number | undefined) {
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
        return '길이 미확인';
    }

    const totalSeconds = Math.max(0, Math.round(duration / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
