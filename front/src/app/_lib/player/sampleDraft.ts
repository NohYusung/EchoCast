import type { PlayerDraft } from './playerDraft.types';

export function createSamplePlayerDraft({
    productId = '100',
    episodeId = '1',
}: {
    productId?: string;
    episodeId?: string;
} = {}): PlayerDraft {
    const productNumericId = toSampleId(productId, 100);
    const episodeNumericId = toSampleId(episodeId, 1);

    return {
        products: [
            {
                id: productNumericId,
                title: '독립 테스트 작품',
                coverImageUrl: '/covers/sample-player.png',
            },
        ],
        episodes: [
            {
                id: episodeNumericId,
                productId: productNumericId,
                episodeNumber: 1,
                title: '1화',
                subTitle: 'timeline/cue manifest 검증',
            },
        ],
        characters: [
            {
                id: 1,
                name: '주인공',
                color: '#2563eb',
                defaultTtsVoiceId: 1,
            },
            {
                id: 2,
                name: '해설',
                color: '#16a34a',
                defaultTtsVoiceId: 2,
            },
        ],
        scripts: [
            {
                id: 5001,
                episodeId: episodeNumericId,
                characterId: 1,
                text: '첫 번째 컷을 열어.',
                sortOrder: 1,
            },
            {
                id: 5002,
                episodeId: episodeNumericId,
                characterId: 2,
                text: '이미지가 천천히 내려간다.',
                sortOrder: 2,
            },
            {
                id: 5003,
                episodeId: episodeNumericId,
                characterId: 1,
                text: '효과음 뒤에 다음 장면으로.',
                sortOrder: 3,
            },
        ],
        tracks: [
            {
                id: 1,
                episodeId: episodeNumericId,
                name: 'Visual',
                kind: 'scroll',
                layerId: 0,
                isMuted: false,
            },
            {
                id: 2,
                episodeId: episodeNumericId,
                name: 'Dialogue',
                kind: 'record',
                layerId: 1,
                isMuted: false,
            },
            {
                id: 3,
                episodeId: episodeNumericId,
                name: 'BGM',
                kind: 'bgm',
                layerId: 2,
                isMuted: false,
            },
            {
                id: 4,
                episodeId: episodeNumericId,
                name: 'Effects',
                kind: 'effect',
                layerId: 3,
                isMuted: false,
            },
        ],
        items: [
            {
                id: 101,
                trackId: 1,
                kind: 'visual',
                startTime: 0,
                endTime: 12000,
                mediaId: 201,
                layerId: 0,
            },
            {
                id: 102,
                trackId: 1,
                kind: 'visual',
                startTime: 7800,
                endTime: 12800,
                mediaId: 202,
                layerId: 1,
            },
            {
                id: 5001,
                trackId: 2,
                kind: 'cue',
                startTime: 0,
                endTime: 2200,
                cueId: 5001,
                layerId: 1,
            },
            {
                id: 5002,
                trackId: 2,
                kind: 'cue',
                startTime: 2600,
                endTime: 6200,
                cueId: 5002,
                layerId: 1,
            },
            {
                id: 5003,
                trackId: 2,
                kind: 'cue',
                startTime: 7600,
                endTime: 10400,
                cueId: 5003,
                layerId: 1,
            },
            {
                id: 9001,
                trackId: 4,
                kind: 'effect',
                startTime: 7200,
                endTime: 7600,
                mediaId: 301,
                layerId: 3,
                volume: 0.8,
            },
        ],
        media: [
            {
                id: 201,
                episodeId: episodeNumericId,
                kind: 'image',
                url: '/media/strip-1.webp',
                naturalWidth: 690,
                naturalHeight: 4200,
            },
            {
                id: 202,
                episodeId: episodeNumericId,
                kind: 'image',
                url: '/media/cutaway-1.webp',
                naturalWidth: 690,
                naturalHeight: 1380,
            },
            {
                id: 301,
                episodeId: episodeNumericId,
                kind: 'effect',
                url: '/audio/effect-hit.wav',
                durationMs: 400,
            },
        ],
        cues: [
            {
                id: 5001,
                episodeId: episodeNumericId,
                scriptId: 5001,
                characterId: 1,
                trackId: 2,
                startTime: 0,
                endTime: 2200,
                ttsVoiceId: 1,
                ttsUrl: '/audio/tts-5001.wav',
                volume: 1,
            },
            {
                id: 5002,
                episodeId: episodeNumericId,
                scriptId: 5002,
                characterId: 2,
                trackId: 2,
                startTime: 2600,
                endTime: 6200,
                ttsVoiceId: 2,
                ttsUrl: '/audio/tts-5002.wav',
                volume: 0.92,
            },
            {
                id: 5003,
                episodeId: episodeNumericId,
                scriptId: 5003,
                characterId: 1,
                trackId: 2,
                startTime: 7600,
                endTime: 10400,
                ttsVoiceId: 1,
                ttsUrl: '/audio/tts-5003.wav',
                volume: 1,
            },
        ],
        records: [
            {
                id: 6001,
                cueId: 5001,
                artistId: 1,
                audioId: 6001,
                recordUrl: '/audio/record-5001.wav',
                duration: 2100,
                isAccepted: true,
            },
            {
                id: 6003,
                cueId: 5003,
                artistId: 1,
                audioId: 6003,
                recordUrl: '/audio/record-5003.wav',
                duration: 2800,
                isAccepted: true,
            },
        ],
    };
}

function toSampleId(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;

    const numberText = value.match(/\d+/)?.[0];
    if (!numberText) return fallback;

    const embedded = Number.parseInt(numberText, 10);
    return Number.isFinite(embedded) ? embedded : fallback;
}
