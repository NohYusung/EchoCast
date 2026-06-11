import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { TtsVoice } from '../../TTS-voices/domain/tts-voice.entity';
import { TtsVoiceRepository } from '../../TTS-voices/repository/tts-voice.repository';
import { Artist } from '../../artists/domain/artist.entity';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { CanvasRepository } from '../../canvases/repository/canvas.repository';
import { Character } from '../../characters/domain/character.entity';
import { CharacterRepository } from '../../characters/repository/characater.repository';
import { Cue } from '../../cues/domain/cue.entity';
import { CueRepository } from '../../cues/repository/cue.repository';
import { Episode } from '../../episodes/domain/episode.entity';
import { EpisodeRepository } from '../../episodes/repository/episode.repository';
import { Media } from '../../medias/domain/media.entity';
import { Product } from '../../products/domain/product.entity';
import { Record as RecordEntity } from '../../records/domain/record.entity';
import { RecordRepository } from '../../records/repository/record.repository';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { ScrollRepository } from '../../scrolls/repository/scroll.repository';
import { Track } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { PlayerService } from './player.service';

describe('PlayerService', () => {
    it('builds a draft and manifest from episode production data', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [
                Artist,
                Canvas,
                Character,
                Cue,
                Episode,
                Media,
                Product,
                RecordEntity,
                Scroll,
                Track,
                TtsVoice,
            ],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const product = await dataSource.manager.save(
                new Product({
                    title: 'Player test product',
                    coverImageUrl: 'https://assets.example.com/cover.png',
                })
            );
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Player test episode',
                    subTitle: 'manifest',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: '나리',
                    role: 'starring',
                })
            );
            const visualTrack = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Visual',
                    type: 'scroll',
                })
            );
            const dialogueTrack = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Dialogue',
                    type: 'record',
                })
            );
            const canvas = await dataSource.manager.save(
                new Canvas({
                    episodeId: episode.id,
                })
            );
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    canvasId: canvas.id,
                    mediaName: 'visual.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/visual.png',
                    index: 0,
                })
            );
            await dataSource.manager.save(
                new Scroll({
                    trackId: visualTrack.id,
                    startTime: 0,
                    endTime: 3000,
                    startPosition: 0,
                    endPosition: 400,
                })
            );
            const ttsVoice = await dataSource.manager.save(
                new TtsVoice({
                    provider: 'test-player',
                    voiceName: 'nari-ko',
                    voiceKey: 'nari',
                    languageCode: 'ko-KR',
                    fileUrl: 'https://assets.example.com/tts.wav',
                })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    script: '플레이어 테스트 대사',
                    characterId: character.id,
                    trackId: dialogueTrack.id,
                    startTime: 500,
                    endTime: 2500,
                    ttsVoiceId: ttsVoice.id,
                    volume: 0.9,
                })
            );
            const artist = await dataSource.manager.save(new Artist({ name: '성우' }));
            await dataSource.manager.save(
                new RecordEntity({
                    cueId: cue.id,
                    artistId: artist.id,
                    status: 'approved',
                    audioUrl: 'https://assets.example.com/record.wav',
                    durationMs: 1900,
                    volume: 0.8,
                })
            );

            const playerService = new PlayerService(
                new EpisodeRepository(dataSource),
                new CharacterRepository(dataSource),
                new TrackRepository(dataSource),
                new CanvasRepository(dataSource),
                new CueRepository(dataSource),
                new ScrollRepository(dataSource),
                new RecordRepository(dataSource),
                new TtsVoiceRepository(dataSource)
            );

            const draft = await playerService.getDraft({ episodeId: episode.id });
            const manifest = await playerService.getManifest({ episodeId: episode.id });

            assert.deepEqual(draft.products, [
                {
                    id: String(product.id),
                    title: 'Player test product',
                    coverImageUrl: 'https://assets.example.com/cover.png',
                },
            ]);
            assert.equal(draft.media[0].id, String(media.id));
            assert.equal(draft.media[0].kind, 'image');
            assert.equal(draft.timelineItems.some((item) => item.kind === 'visual' && item.mediaId === String(media.id)), true);
            assert.equal(draft.scripts[0].text, '플레이어 테스트 대사');
            assert.equal(draft.scripts[0].id, draft.cues[0].scriptId);
            assert.equal(draft.cues[0].id, String(cue.id));
            assert.equal(draft.records[0].audioUrl, 'https://assets.example.com/record.wav');

            assert.equal(manifest.episodeId, String(episode.id));
            assert.equal(manifest.durationMs, 3000);
            assert.equal(manifest.cues[0].approvedRecordUrl, 'https://assets.example.com/record.wav');
            assert.equal(manifest.tts[0].audioUrl, 'https://assets.example.com/tts.wav');
        } finally {
            await dataSource.destroy();
        }
    });
});
