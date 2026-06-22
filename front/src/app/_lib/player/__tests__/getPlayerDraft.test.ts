import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getPlayerDraft } from '../getPlayerDraft';

const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const originalFetch = globalThis.fetch;

afterEach(() => {
    if (originalApiBaseUrl === undefined) {
        delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
        process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }

    globalThis.fetch = originalFetch;
});

test('getPlayerDraft builds recording draft from production APIs instead of sample data', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4100';
    const requestedUrls: string[] = [];

    globalThis.fetch = (async (input, init) => {
        requestedUrls.push(String(input));
        assert.equal(init?.cache, 'no-store');

        if (String(input) === 'http://localhost:4100/products/1') {
            return jsonResponse({
                data: {
                    id: 1,
                    title: '진격의 거인',
                    coverImageUrl: 'https://assets.example.com/cover.jpg',
                },
            });
        }

        if (String(input) === 'http://localhost:4100/products/1/episodes/1') {
            return jsonResponse({
                data: {
                    id: 1,
                    productId: 1,
                    episodeNumber: 1,
                    title: '실제 에피소드',
                    subTitle: 'API',
                },
            });
        }

        if (String(input) === 'http://localhost:4100/products/1/characters') {
            return jsonResponse({
                data: {
                    items: [
                        {
                            id: 7,
                            productId: 1,
                            name: '엘렌 예거',
                            role: 'starring',
                            imageUrl: 'https://assets.example.com/characters/eren.png',
                        },
                    ],
                    total: 1,
                },
            });
        }

        if (String(input) === 'http://localhost:4100/episodes/1/tracks') {
            return jsonResponse({
                data: {
                    items: [
                        {
                            id: 2,
                            episodeId: 1,
                            name: '엘렌 예거 보이스',
                            type: 'record',
                            characterId: 7,
                            isMuted: false,
                            cues: [
                                {
                                    id: 31,
                                    script: '실제 API 대사입니다.',
                                    duration: 1800,
                                    characterId: 7,
                                    trackId: 2,
                                    audioId: 88,
                                    startCanvasMediaId: 302,
                                    endCanvasMediaId: 302,
                                    startTime: 4000,
                                    endTime: 6100,
                                    audioStartTime: 200,
                                    audioEndTime: 2300,
                                    startPosition: 12,
                                    endPosition: 32,
                                    volume: 1,
                                },
                            ],
                            scrolls: [],
                        },
                    ],
                    total: 1,
                },
            });
        }

        if (String(input) === 'http://localhost:4100/player/manifest/1') {
            return jsonResponse({
                data: {
                    episodeId: 1,
                    totalDuration: 6100,
                    tracks: [
                        {
                            id: 2,
                            name: '엘렌 예거 보이스',
                            kind: 'record',
                            layerId: 0,
                            isMuted: false,
                        },
                    ],
                    items: [
                        {
                            id: 31,
                            trackId: 2,
                            kind: 'cue',
                            startTime: 4000,
                            endTime: 6100,
                            cueId: 31,
                            layerId: 0,
                            volume: 1,
                        },
                    ],
                    cues: [
                        {
                            id: 31,
                            scriptId: 31,
                            characterId: 7,
                            trackId: 2,
                            startTime: 4000,
                            endTime: 6100,
                            volume: 1,
                        },
                    ],
                    media: [],
                    records: [
                        {
                            id: 44,
                            cueId: 31,
                            artistId: 9,
                            audioId: 44,
                            recordUrl: 'https://assets.example.com/record.wav',
                            duration: 1900,
                            isAccepted: true,
                        },
                    ],
                    tts: [],
                },
            });
        }

        return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const draft = await getPlayerDraft({ productId: '1', episodeId: '1' });

    assert.equal(requestedUrls.includes('http://localhost:4100/episodes/1/player-draft'), false);
    assert.deepEqual(draft.products, [
        {
            id: 1,
            title: '진격의 거인',
            coverImageUrl: 'https://assets.example.com/cover.jpg',
        },
    ]);
    assert.equal(draft.episodes[0]?.title, '실제 에피소드');
    assert.equal(draft.characters[0]?.name, '엘렌 예거');
    assert.equal(draft.characters[0]?.imageUrl, 'https://assets.example.com/characters/eren.png');
    assert.equal(draft.scripts[0]?.text, '실제 API 대사입니다.');
    assert.equal(draft.scripts[0]?.durationMs, 1800);
    assert.equal(draft.cues[0]?.id, 31);
    assert.equal(draft.cues[0]?.audioId, 88);
    assert.equal(draft.cues[0]?.startCanvasMediaId, 302);
    assert.equal(draft.cues[0]?.endCanvasMediaId, 302);
    assert.equal(draft.cues[0]?.audioStartTime, 200);
    assert.equal(draft.cues[0]?.audioEndTime, 2300);
    assert.equal(draft.cues[0]?.startPosition, 12);
    assert.equal(draft.cues[0]?.endPosition, 32);
    assert.equal(draft.records[0]?.recordUrl, 'https://assets.example.com/record.wav');
});

test('getPlayerDraft can reuse a provided manifest without requesting the player manifest endpoint', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4100';
    const requestedUrls: string[] = [];

    globalThis.fetch = (async (input, init) => {
        requestedUrls.push(String(input));
        assert.equal(init?.cache, 'no-store');

        if (String(input) === 'http://localhost:4100/products/1') {
            return jsonResponse({
                data: {
                    id: 1,
                    title: '진격의 거인',
                },
            });
        }

        if (String(input) === 'http://localhost:4100/products/1/episodes/2') {
            return jsonResponse({
                data: {
                    id: 2,
                    productId: 1,
                    episodeNumber: 2,
                    title: '새 에피소드',
                },
            });
        }

        if (String(input) === 'http://localhost:4100/products/1/characters') {
            return jsonResponse({ data: { items: [] } });
        }

        if (String(input) === 'http://localhost:4100/episodes/2/tracks') {
            return jsonResponse({ data: { items: [] } });
        }

        return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const draft = await getPlayerDraft({
        productId: '1',
        episodeId: '2',
        initialManifest: {
            episodeId: 2,
            totalDuration: 0,
            tracks: [],
            items: [],
            cues: [],
            media: [],
            records: [],
            tts: [],
        },
    });

    assert.equal(requestedUrls.includes('http://localhost:4100/player/manifest/2'), false);
    assert.equal(draft.products[0]?.title, '진격의 거인');
    assert.equal(draft.episodes[0]?.title, '새 에피소드');
});

function jsonResponse(payload: unknown) {
    return new Response(JSON.stringify(payload), { status: 200 });
}
