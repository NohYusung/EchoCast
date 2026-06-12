import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyTimelineItemTimings, saveTimelineItemTimings } from '../studioDraft';
import type { PlayerDraft } from '../playerDraft.types';

function createDraft(): PlayerDraft {
    return {
        products: [],
        episodes: [
            {
                id: 'sample-player',
                productId: 'product-100',
                episodeNumber: 1,
                title: '1화',
            },
        ],
        characters: [],
        scripts: [],
        tracks: [],
        items: [
            {
                id: 'visual-strip-1',
                trackId: 'track-visual',
                kind: 'visual',
                startTime: 0,
                endTime: 12000,
                layerId: 0,
                mediaId: 'media-strip-1',
            },
            {
                id: 'cue-item-5001',
                trackId: 'track-dialogue',
                kind: 'cue',
                startTime: 0,
                endTime: 2200,
                layerId: 1,
                cueId: 'cue-5001',
            },
        ],
        media: [],
        ttsVoices: [],
        cues: [
            {
                id: 'cue-5001',
                episodeId: 'sample-player',
                scriptId: 'script-5001',
                characterId: 'character-hero',
                trackId: 'track-dialogue',
                startTime: 0,
                endTime: 2200,
                ttsVoiceId: 'voice-hero',
                ttsUrl: '/audio/tts-5001.wav',
                volume: 1,
            },
        ],
        records: [],
    };
}

test('applyTimelineItemTimings updates selected item timing without mutating the source draft', () => {
    const draft = createDraft();
    const updated = applyTimelineItemTimings(draft, [
        {
            itemId: 'cue-item-5001',
            startTime: 500,
            endTime: 2700,
        },
    ]);

    assert.equal(draft.items[1].startTime, 0);
    assert.equal(updated.items[1].startTime, 500);
    assert.equal(updated.items[1].endTime, 2700);
});

test('applyTimelineItemTimings keeps cue timing in sync with cue timeline items', () => {
    const draft = createDraft();
    const updated = applyTimelineItemTimings(draft, [
        {
            itemId: 'cue-item-5001',
            startTime: 700,
            endTime: 2900,
        },
    ]);

    assert.equal(updated.items[1].startTime, 700);
    assert.equal(updated.cues[0].startTime, 700);
    assert.equal(updated.cues[0].endTime, 2900);
});

test('saveTimelineItemTimings fetches the current draft, applies edits, and sends PUT draft payload', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
        calls.push({ url: String(url), init });

        if (!init) {
            return new Response(JSON.stringify(createDraft()), { status: 200 });
        }

        const body = JSON.parse(String(init.body)) as PlayerDraft;
        assert.equal(body.items[0].startTime, 1000);
        assert.equal(body.items[0].endTime, 13000);

        return new Response(
            JSON.stringify({
                manifest: {
                    episodeId: 'sample-player',
                    durationMs: 13000,
                },
            }),
            { status: 200 }
        );
    };

    const result = await saveTimelineItemTimings({
        apiBaseUrl: 'http://localhost:4100',
        episodeId: 'sample-player',
        updates: [
            {
                itemId: 'visual-strip-1',
                startTime: 1000,
                endTime: 13000,
            },
        ],
        fetchImpl,
    });

    assert.equal(calls[0].url, 'http://localhost:4100/episodes/sample-player/player-draft');
    assert.equal(calls[1].url, 'http://localhost:4100/episodes/sample-player/player-draft');
    assert.equal(calls[1].init?.method, 'PUT');
    assert.equal(result.durationMs, 13000);
});
