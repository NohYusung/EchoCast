import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getPlayerManifest } from '../getPlayerManifest';

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

test('getPlayerManifest unwraps API data response', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4100';
    const requestedUrls: string[] = [];

    globalThis.fetch = (async (input, init) => {
        requestedUrls.push(String(input));
        assert.equal(init?.cache, 'no-store');

        return new Response(
            JSON.stringify({
                data: {
                    episodeId: '1',
                    durationMs: 1000,
                    tracks: [],
                    items: [],
                    cues: [],
                    media: [],
                    records: [],
                    tts: [],
                },
            }),
            { status: 200 }
        );
    }) as typeof fetch;

    const manifest = await getPlayerManifest('1');

    assert.deepEqual(requestedUrls, ['http://localhost:4100/player/manifest/1']);
    assert.equal(manifest.episodeId, '1');
    assert.equal(manifest.durationMs, 1000);
});
