import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    buildRecordingCueStripMarkers,
    buildRecordingCueQueue,
    filterRecordingCueQueue,
    getRecordingProgress,
    selectInitialRecordingCue,
    toRecordingStripSize,
} from '../recordingStudio';
import type { PlayerDraft } from '../playerDraft.types';
import type { PlayerManifest } from '../playerManifest.types';

const draft: PlayerDraft = {
    products: [{ id: 1, title: '학원의 비밀' }],
    episodes: [{ id: 1, productId: 1, episodeNumber: 1, title: '전학생' }],
    characters: [
        { id: 1, name: '지후', color: '#3b82f6', imageUrl: 'https://assets.example.com/characters/jihu.png' },
        { id: 2, name: '서연', color: '#10b981' },
    ],
    scripts: [
        { id: 2, episodeId: 1, characterId: 1, text: '저 눈빛... 어디서 봤더라.', durationMs: 1800, sortOrder: 2 },
        { id: 1, episodeId: 1, characterId: 1, text: '또 늦었네...', sortOrder: 1 },
        { id: 3, episodeId: 1, characterId: 2, text: '거기 서.', sortOrder: 3 },
    ],
    tracks: [{ id: 10, episodeId: 1, name: '지후 보이스', kind: 'record', layerId: 1, isMuted: false }],
    items: [],
    media: [],
    cues: [
        {
            id: 2,
            episodeId: 1,
            scriptId: 2,
            characterId: 1,
            trackId: 10,
            startCanvasMediaId: 302,
            endCanvasMediaId: 302,
            startTime: 2500,
            endTime: 5200,
            startPosition: 64,
            endPosition: 64,
            volume: 1,
        },
        {
            id: 1,
            episodeId: 1,
            scriptId: 1,
            characterId: 1,
            trackId: 10,
            startCanvasMediaId: 301,
            endCanvasMediaId: 301,
            startTime: 0,
            endTime: 2100,
            startPosition: 18,
            endPosition: 18,
            volume: 1,
        },
        {
            id: 3,
            episodeId: 1,
            scriptId: 3,
            characterId: 2,
            trackId: 10,
            startTime: 6000,
            endTime: 7200,
            volume: 1,
        },
    ],
    records: [
        {
            id: 101,
            cueId: 1,
            artistId: 1,
            audioId: 101,
            recordUrl: '/record-1.wav',
            duration: 1900,
            isAccepted: true,
        },
    ],
};

const manifest: PlayerManifest = {
    episodeId: 1,
    totalDuration: 7200,
    tracks: [],
    items: [],
    cues: [
        {
            id: 2,
            scriptId: 2,
            characterId: 1,
            trackId: 10,
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
    const queue = buildRecordingCueQueue({ draft, manifest, characterId: 1 });

    assert.deepEqual(
        queue.map((item) => ({
            cueId: item.cueId,
            text: item.text,
            status: item.status,
            takeCount: item.takeCount,
            latestRecordUrl: item.latestRecordUrl,
            characterImageUrl: item.characterImageUrl,
            durationMs: item.durationMs,
            isAccepted: item.records.at(-1)?.isAccepted,
        })),
        [
            {
                cueId: 1,
                text: '또 늦었네...',
                status: 'done',
                takeCount: 1,
                latestRecordUrl: '/record-1.wav',
                characterImageUrl: 'https://assets.example.com/characters/jihu.png',
                durationMs: 2100,
                isAccepted: true,
            },
            {
                cueId: 2,
                text: '저 눈빛... 어디서 봤더라.',
                status: 'done',
                takeCount: 1,
                latestRecordUrl: '/record-2.wav',
                characterImageUrl: 'https://assets.example.com/characters/jihu.png',
                durationMs: 1800,
                isAccepted: true,
            },
        ],
    );
});

test('getRecordingProgress counts total, done, and pending cues', () => {
    const queue = buildRecordingCueQueue({ draft, characterId: 1 });

    assert.deepEqual(getRecordingProgress(queue), {
        total: 2,
        done: 1,
        pending: 1,
        percent: 50,
    });
});

test('selectInitialRecordingCue prefers the first pending cue and falls back to the first cue', () => {
    const queue = buildRecordingCueQueue({ draft, characterId: 1 });

    assert.equal(selectInitialRecordingCue(queue)?.cueId, 2);
    assert.equal(selectInitialRecordingCue(filterRecordingCueQueue(queue, 'done'))?.cueId, 1);
});

test('buildRecordingCueQueue preserves saved strip placement fields for recording markers', () => {
    const queue = buildRecordingCueQueue({ draft, characterId: 1 });

    assert.deepEqual(
        queue.map((item) => ({
            cueId: item.cueId,
            startCanvasMediaId: item.startCanvasMediaId,
            startPosition: item.startPosition,
        })),
        [
            { cueId: 1, startCanvasMediaId: 301, startPosition: 18 },
            { cueId: 2, startCanvasMediaId: 302, startPosition: 64 },
        ],
    );
});

test('buildRecordingCueQueue carries cue audio trim range onto the matching record', () => {
    const queue = buildRecordingCueQueue({
        draft: {
            ...draft,
            cues: draft.cues.map((cue) =>
                cue.id === 1
                    ? {
                          ...cue,
                          audioId: 101,
                          audioStartTime: 400,
                          audioEndTime: 1700,
                      }
                    : cue,
            ),
        },
        characterId: 1,
    });

    assert.deepEqual(
        queue[0]?.records.map((record) => ({
            audioId: record.audioId,
            durationMs: record.durationMs,
            audioStartTime: record.audioStartTime,
            audioEndTime: record.audioEndTime,
        })),
        [
            {
                audioId: 101,
                durationMs: 1900,
                audioStartTime: 400,
                audioEndTime: 1700,
            },
        ],
    );
});

test('buildRecordingCueQueue only includes cues that belong to record tracks', () => {
    const queue = buildRecordingCueQueue({
        draft: {
            ...draft,
            tracks: [
                ...draft.tracks,
                { id: 20, episodeId: 1, name: '효과음', kind: 'audio', layerId: 2, isMuted: false },
            ],
            cues: [
                ...draft.cues,
                {
                    id: 4,
                    episodeId: 1,
                    scriptId: 3,
                    characterId: 2,
                    trackId: 20,
                    startTime: 8000,
                    endTime: 9000,
                    volume: 1,
                },
            ],
        },
    });

    assert.deepEqual(queue.map((item) => item.cueId), [1, 2, 3]);
});

test('buildRecordingCueStripMarkers maps saved canvas media positions to strip markers', () => {
    const queue = buildRecordingCueQueue({ draft });
    const markers = buildRecordingCueStripMarkers({ queue, selectedCueId: 2 });

    assert.deepEqual(
        markers.map((marker) => ({
            cueId: marker.cueId,
            characterName: marker.characterName,
            canvasMediaId: marker.canvasMediaId,
            positionPercent: marker.positionPercent,
            topPercent: marker.topPercent,
            isSelected: marker.isSelected,
        })),
        [
            {
                cueId: 1,
                characterName: '지후',
                canvasMediaId: 301,
                positionPercent: 18,
                topPercent: 18,
                isSelected: false,
            },
            {
                cueId: 2,
                characterName: '지후',
                canvasMediaId: 302,
                positionPercent: 64,
                topPercent: 64,
                isSelected: true,
            },
            {
                cueId: 3,
                characterName: '서연',
                canvasMediaId: undefined,
                positionPercent: 83.33,
                topPercent: 83.33,
                isSelected: false,
            },
        ],
    );
});

test('toRecordingStripSize scales the strip while preserving media ratio', () => {
    assert.deepEqual(toRecordingStripSize(150), {
        scale: 150,
        width: 480,
        panelWidth: 544,
        fallbackHeight: 246,
    });

    assert.deepEqual(toRecordingStripSize(1000), {
        scale: 200,
        width: 640,
        panelWidth: 704,
        fallbackHeight: 328,
    });
});
