import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    buildFileUploadUrlRequests,
    buildMediaUploadQueue,
    buildMediaRegistrationRequest,
    toMediaUploadFailureMessage,
    uploadFileToPresignedUrl,
} from '../mediaUploadBatch';

test('buildMediaUploadQueue keeps valid files in order and records invalid files as failures', () => {
    const files = [{ name: 'a.png' }, { name: 'notes.txt' }, { name: 'b.mp4' }];

    const result = buildMediaUploadQueue({
        episodeId: '7',
        files,
        getMediaType: (file) => (file.name.endsWith('.png') ? 'image' : file.name.endsWith('.mp4') ? 'video' : null),
        getUploadKey: (episodeId, file, mediaType) => `${episodeId}/${mediaType}/${file.name}`,
    });

    assert.deepEqual(result.items, [
        {
            file: files[0],
            fileName: 'a.png',
            key: '7/image/a.png',
            mediaType: 'image',
        },
        {
            file: files[2],
            fileName: 'b.mp4',
            key: '7/video/b.mp4',
            mediaType: 'video',
        },
    ]);
    assert.deepEqual(result.failures, [
        {
            error: '이미지 또는 영상 파일만 등록할 수 있습니다.',
            fileName: 'notes.txt',
        },
    ]);
});

test('toMediaUploadFailureMessage lists failed file names', () => {
    assert.equal(toMediaUploadFailureMessage([]), undefined);
    assert.equal(toMediaUploadFailureMessage([{ fileName: 'a.txt', error: 'invalid' }]), '등록 실패: a.txt');
    assert.equal(
        toMediaUploadFailureMessage([
            { fileName: 'a.txt', error: 'invalid' },
            { fileName: 'b.mov', error: 'upload failed' },
        ]),
        '등록 실패: a.txt, b.mov',
    );
});

test('buildFileUploadUrlRequests includes explicit content types for each upload key', () => {
    const files = [
        { name: 'clip.mov', type: '' },
        { name: 'render.mp4', type: 'video/mp4' },
    ];
    const uploadQueue = buildMediaUploadQueue({
        episodeId: '7',
        files,
        getMediaType: (file) => (file.name.endsWith('.mov') || file.name.endsWith('.mp4') ? 'video' : null),
        getUploadKey: (episodeId, file, mediaType) => `${episodeId}/${mediaType}/${file.name}`,
    });

    assert.deepEqual(buildFileUploadUrlRequests(uploadQueue.items), [
        {
            key: '7/video/clip.mov',
            contentType: 'video/quicktime',
        },
        {
            key: '7/video/render.mp4',
            contentType: 'video/mp4',
        },
    ]);
});

test('buildMediaRegistrationRequest includes video duration when metadata was resolved', () => {
    assert.deepEqual(
        buildMediaRegistrationRequest({
            item: {
                fileName: 'clip.mp4',
                mediaType: 'video',
            },
            mediaUrl: 'https://assets.example.com/clip.mp4',
            duration: 12345,
        }),
        {
            mediaName: 'clip.mp4',
            mediaType: 'video',
            mediaUrl: 'https://assets.example.com/clip.mp4',
            duration: 12345,
        },
    );
});

test('buildMediaRegistrationRequest omits image duration', () => {
    assert.deepEqual(
        buildMediaRegistrationRequest({
            item: {
                fileName: 'cover.png',
                mediaType: 'image',
            },
            mediaUrl: 'https://assets.example.com/cover.png',
            duration: 12345,
        }),
        {
            mediaName: 'cover.png',
            mediaType: 'image',
            mediaUrl: 'https://assets.example.com/cover.png',
        },
    );
});

test('uploadFileToPresignedUrl sends the signed content type header', async (t) => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ input, init });
        return new Response(null, { status: 200 });
    }) as typeof fetch;
    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    await uploadFileToPresignedUrl('https://uploads.example.com/clip.mov', new Blob(['video']), 'video/quicktime');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].init?.method, 'PUT');
    assert.deepEqual(calls[0].init?.headers, {
        'Content-Type': 'video/quicktime',
    });
});
