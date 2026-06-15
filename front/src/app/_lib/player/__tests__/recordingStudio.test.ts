import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    buildRecordingCueQueue,
    filterRecordingCueQueue,
    getRecordingProgress,
    selectInitialRecordingCue,
} from '../recordingStudio';
import type { PlayerDraft } from '../playerDraft.types';
import type { PlayerManifest } from '../playerManifest.types';

const draft: PlayerDraft = {
    products: [{ id: '1', title: '학원의 비밀' }],
    episodes: [{ id: '1', productId: '1', episodeNumber: 1, title: '전학생' }],
    characters: [
        { id: 'hero', name: '지후', color: '#3b82f6' },
        { id: 'rival', name: '서연', color: '#10b981' },
    ],
    scripts: [
        { id: 'script-2', episodeId: '1', characterId: 'hero', text: '저 눈빛... 어디서 봤더라.', sortOrder: 2 },
        { id: 'script-1', episodeId: '1', characterId: 'hero', text: '또 늦었네...', sortOrder: 1 },
        { id: 'script-3', episodeId: '1', characterId: 'rival', text: '거기 서.', sortOrder: 3 },
    ],
    tracks: [{ id: 'dialogue', episodeId: '1', name: '지후 보이스', kind: 'dialogue', layerId: 1, isMuted: false }],
    items: [],
    media: [],
    ttsVoices: [],
    cues: [
        {
            id: 'cue-2',
            episodeId: '1',
            scriptId: 'script-2',
            characterId: 'hero',
            trackId: 'dialogue',
            startTime: 2500,
            endTime: 5200,
            volume: 1,
        },
        {
            id: 'cue-1',
            episodeId: '1',
            scriptId: 'script-1',
            characterId: 'hero',
            trackId: 'dialogue',
            startTime: 0,
            endTime: 2100,
            volume: 1,
        },
        {
            id: 'cue-3',
            episodeId: '1',
            scriptId: 'script-3',
            characterId: 'rival',
            trackId: 'dialogue',
            startTime: 6000,
            endTime: 7200,
            volume: 1,
        },
    ],
    records: [
        {
            id: 'record-1',
            cueId: 'cue-1',
            artistId: 'artist-1',
            recordUrl: '/record-1.wav',
            duration: 1900,
            volume: 1,
            isAccepted: true,
        },
    ],
};

const manifest: PlayerManifest = {
    episodeId: '1',
    durationMs: 7200,
    tracks: [],
    items: [],
    cues: [
        {
            id: 'cue-2',
            scriptId: 'script-2',
            characterId: 'hero',
            trackId: 'dialogue',
            startTime: 2500,
            endTime: 5200,
            approvedRecordUrl: '/record-2.wav',
            volume: 1,
        },
    ],
    media: [],
    records: [],
    tts: [],
};

test('buildRecordingCueQueue sorts scripts and marks draft or manifest recorded cues done', () => {
    const queue = buildRecordingCueQueue({ draft, manifest, characterId: 'hero' });

    assert.deepEqual(
        queue.map((item) => ({
            cueId: item.cueId,
            text: item.text,
            status: item.status,
            takeCount: item.takeCount,
            latestRecordUrl: item.latestRecordUrl,
            isAccepted: item.records.at(-1)?.isAccepted,
        })),
        [
            {
                cueId: 'cue-1',
                text: '또 늦었네...',
                status: 'done',
                takeCount: 1,
                latestRecordUrl: '/record-1.wav',
                isAccepted: true,
            },
            {
                cueId: 'cue-2',
                text: '저 눈빛... 어디서 봤더라.',
                status: 'done',
                takeCount: 1,
                latestRecordUrl: '/record-2.wav',
                isAccepted: true,
            },
        ],
    );
});

test('getRecordingProgress counts total, done, and pending cues', () => {
    const queue = buildRecordingCueQueue({ draft, characterId: 'hero' });

    assert.deepEqual(getRecordingProgress(queue), {
        total: 2,
        done: 1,
        pending: 1,
        percent: 50,
    });
});

test('selectInitialRecordingCue prefers the first pending cue and falls back to the first cue', () => {
    const queue = buildRecordingCueQueue({ draft, characterId: 'hero' });

    assert.equal(selectInitialRecordingCue(queue)?.cueId, 'cue-2');
    assert.equal(selectInitialRecordingCue(filterRecordingCueQueue(queue, 'done'))?.cueId, 'cue-1');
});
