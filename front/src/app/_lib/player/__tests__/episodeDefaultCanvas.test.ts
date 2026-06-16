import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { updateEpisodeDefaultCanvas } from '../episodeDefaultCanvas';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

test('updateEpisodeDefaultCanvas stores the selected editor canvas on the episode', async () => {
    const requests: Array<{ input: string; init: RequestInit | undefined }> = [];

    globalThis.fetch = (async (input, init) => {
        requests.push({ input: String(input), init });
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
    }) as typeof fetch;

    await updateEpisodeDefaultCanvas('http://localhost:4100/', {
        productId: '2',
        episodeId: '7',
        defaultCanvasId: 13,
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].input, 'http://localhost:4100/products/2/episodes/7');
    assert.equal(requests[0].init?.method, 'PUT');
    assert.deepEqual(requests[0].init?.headers, { 'content-type': 'application/json' });
    assert.equal(requests[0].init?.body, JSON.stringify({ defaultCanvasId: 13 }));
});

test('updateEpisodeDefaultCanvas fails when the episode update API rejects the canvas', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'not found' }), { status: 404 })) as typeof fetch;

    await assert.rejects(
        () =>
            updateEpisodeDefaultCanvas('http://localhost:4100', {
                productId: '2',
                episodeId: '7',
                defaultCanvasId: 13,
            }),
        /Episode default canvas update failed: 404/
    );
});
