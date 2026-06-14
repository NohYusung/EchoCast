import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCutEditMediaDetails } from '../cutEditMediaDetails';

test('getCutEditMediaDetails exposes canvas media identifiers for the cut edit panel', () => {
    assert.deepEqual(
        getCutEditMediaDetails({
            canvasId: 11,
            index: 2,
            label: 'opening-shot.png',
            mediaId: 42,
            mediaType: 'image',
        }),
        [
            { label: '파일명', value: 'opening-shot.png' },
            { label: '미디어 ID', value: '42' },
            { label: '캔버스 ID', value: '11' },
            { label: '캔버스 순서', value: '3' },
            { label: '타입', value: 'image' },
        ],
    );
});

test('getCutEditMediaDetails marks missing canvas ids as unsaved canvas media', () => {
    assert.deepEqual(
        getCutEditMediaDetails({
            label: 'pending-video.mp4',
            mediaDuration: 125000,
            mediaId: 7,
            mediaType: 'video',
        }),
        [
            { label: '파일명', value: 'pending-video.mp4' },
            { label: '미디어 ID', value: '7' },
            { label: '캔버스 ID', value: '미저장' },
            { label: '캔버스 순서', value: '-' },
            { label: '타입', value: 'video' },
            { label: '길이', value: '02:05' },
        ],
    );
});

test('getCutEditMediaDetails marks missing video duration explicitly', () => {
    assert.deepEqual(
        getCutEditMediaDetails({
            label: 'pending-video.mp4',
            mediaId: 7,
            mediaType: 'video',
        }),
        [
            { label: '파일명', value: 'pending-video.mp4' },
            { label: '미디어 ID', value: '7' },
            { label: '캔버스 ID', value: '미저장' },
            { label: '캔버스 순서', value: '-' },
            { label: '타입', value: 'video' },
            { label: '길이', value: '길이 미확인' },
        ],
    );
});
