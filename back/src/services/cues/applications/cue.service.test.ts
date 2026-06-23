import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Anchor } from '../../anchors/domain/anchor.entity';
import { Audio } from '../../audios/domain/audio.entity';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { CanvasMediaRepository } from '../../canvas-medias/repository/canvas-media.repository';
import { Canvas } from '../../canvases/domain/canvas.entity';
import { Character } from '../../characters/domain/character.entity';
import { Media } from '../../medias/domain/media.entity';
import { Product } from '../../products/domain/product.entity';
import { Episode } from '../../episodes/domain/episode.entity';
import { Scroll } from '../../scrolls/domain/scroll.entity';
import { Script } from '../../scripts/domain/script.entity';
import { ScriptRepository } from '../../scripts/repository/script.repository';
import { Track } from '../../tracks/domain/track.entity';
import { TrackRepository } from '../../tracks/repository/track.repository';
import { Cue } from '../domain/cue.entity';
import { CueRepository } from '../repository/cue.repository';
import { CueService } from './cue.service';

async function createCueServiceDataSource() {
    const dataSource = new DataSource({
        type: 'sqljs',
        entities: [Anchor, Audio, CanvasMedia, Canvas, Character, Cue, Episode, Media, Product, Scroll, Script, Track],
        synchronize: true,
        logging: false,
    });
    await dataSource.initialize();
    return dataSource;
}

function createCueService(dataSource: DataSource) {
    return new CueService(
        new CueRepository(dataSource),
        new TrackRepository(dataSource),
        new CanvasMediaRepository(dataSource),
        new ScriptRepository(dataSource)
    );
}

describe('CueService', () => {
    it('creates a cue with script text for a character-linked track', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue service product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue service episode',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Cue service character',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue service track',
                    type: 'record',
                    characterId: character.id,
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'cue-strip.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/cue-strip.png',
                })
            );
            const canvasMedia = await dataSource.manager.save(
                new CanvasMedia({ canvasId: canvas.id, mediaId: media.id, index: 0 })
            );
            const cueService = createCueService(dataSource);

            const created = await cueService.create({
                trackId: track.id,
                script: '새 큐 대사',
                duration: 2300,
                startCanvasMediaId: canvasMedia.id,
                startPosition: 12.5,
                endPosition: 64,
                volume: 0.8,
            });

            const [storedCue] = await dataSource.manager.find(Cue, {
                where: {
                    id: created.id,
                },
            });
            assert.equal(created.script, '새 큐 대사');
            assert.equal(created.duration, 2300);
            assert.equal(created.startCanvasMediaId, canvasMedia.id);
            assert.equal(created.endCanvasMediaId, canvasMedia.id);
            assert.equal(created.startPosition, 12.5);
            assert.equal(created.endPosition, 64);
            assert.equal(storedCue.trackId, track.id);
            assert.equal(typeof storedCue.scriptId, 'number');
            assert.equal(storedCue.characterId, character.id);
            assert.equal(storedCue.startCanvasMediaId, canvasMedia.id);
            assert.equal(storedCue.endCanvasMediaId, canvasMedia.id);
            assert.equal(storedCue.startTime ?? undefined, undefined);
            assert.equal(storedCue.endTime ?? undefined, undefined);
            assert.equal(storedCue.startPosition, 12.5);
            assert.equal(storedCue.endPosition, 64);
            assert.equal(storedCue.volume, 0.8);

            const storedScriptId = storedCue.scriptId;
            if (typeof storedScriptId !== 'number') {
                throw new Error('created cue should reference a script row');
            }
            const storedScript = await dataSource.manager.findOneByOrFail(Script, { id: storedScriptId });
            assert.equal(storedScript.line, '새 큐 대사');
            assert.equal(storedScript.duration, 2300);

            await cueService.update({
                trackId: track.id,
                cueId: created.id,
                script: '시간 미배정 큐 수정',
                duration: 1800,
            });

            const updatedCue = await dataSource.manager.findOneOrFail(Cue, {
                where: { id: created.id },
                relations: { scriptRef: true },
            });
            assert.equal(updatedCue.scriptRef?.line, '시간 미배정 큐 수정');
            assert.equal(updatedCue.scriptRef?.duration, 1800);
            assert.equal(updatedCue.startTime ?? undefined, undefined);
            assert.equal(updatedCue.endTime ?? undefined, undefined);
        } finally {
            await dataSource.destroy();
        }
    });

    it('throws NotFoundException when the target track does not exist', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const cueService = createCueService(dataSource);

            await assert.rejects(
                () =>
                    cueService.create({
                        trackId: 9999,
                        script: '없는 트랙',
                        startTime: 0,
                        endTime: 1000,
                    }),
                (error: unknown) => error instanceof NotFoundException
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('throws BadRequestException when the target record track has no character', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue service product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue service episode',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue service record track',
                    type: 'record',
                })
            );
            const cueService = createCueService(dataSource);

            await assert.rejects(
                () =>
                    cueService.create({
                        trackId: track.id,
                        script: '캐릭터 없는 트랙',
                        startTime: 0,
                        endTime: 1000,
                    }),
                (error: unknown) => error instanceof BadRequestException
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('lists cues for a track ordered by start time', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue list product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue list episode',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Cue list character',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue list track',
                    type: 'record',
                    characterId: character.id,
                })
            );
            const [secondScript, firstScript] = await dataSource.manager.save([
                new Script({ line: '두 번째 큐' }),
                new Script({ line: '첫 번째 큐' }),
            ]);
            await dataSource.manager.save([
                new Cue({
                    scriptId: secondScript.id,
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 2000,
                    endTime: 3000,
                }),
                new Cue({
                    scriptId: firstScript.id,
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 500,
                    endTime: 1200,
                    volume: 0.8,
                }),
            ]);
            const cueService = createCueService(dataSource);

            const result = await cueService.list({ trackId: track.id });

            assert.equal(result.total, 2);
            assert.equal(result.items[0].script, '첫 번째 큐');
            assert.equal(result.items[0].startTime, 500);
            assert.equal(result.items[0].volume, 0.8);
            assert.equal(result.items[1].script, '두 번째 큐');
            assert.equal(result.items[1].startTime, 2000);
        } finally {
            await dataSource.destroy();
        }
    });

    it('updates a cue with trimmed script text and timing', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue update product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue update episode',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Cue update character',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue update track',
                    type: 'record',
                    characterId: character.id,
                })
            );
            const canvas = await dataSource.manager.save(new Canvas({ episodeId: episode.id }));
            const media = await dataSource.manager.save(
                new Media({
                    episodeId: episode.id,
                    mediaName: 'cue-update-strip.png',
                    mediaType: 'image',
                    mediaUrl: 'https://assets.example.com/cue-update-strip.png',
                })
            );
            const canvasMedia = await dataSource.manager.save(
                new CanvasMedia({ canvasId: canvas.id, mediaId: media.id, index: 0 })
            );
            const script = await dataSource.manager.save(
                new Script({ line: '수정 전 대사' })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    scriptId: script.id,
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 1000,
                    endTime: 3000,
                    volume: 1,
                })
            );
            const cueService = createCueService(dataSource);

            await cueService.update({
                trackId: track.id,
                cueId: cue.id,
                script: '  수정 후 대사  ',
                startTime: 1500,
                endTime: 4500,
                startCanvasMediaId: canvasMedia.id,
                startPosition: 22,
                endPosition: 88,
                volume: 0.7,
            });

            const [storedCue] = await dataSource.manager.find(Cue, {
                where: {
                    id: cue.id,
                },
                relations: {
                    scriptRef: true,
                },
            });
            assert.equal(storedCue.scriptRef?.line, '수정 후 대사');
            assert.equal(storedCue.characterId, character.id);
            assert.equal(storedCue.trackId, track.id);
            assert.equal(storedCue.startCanvasMediaId, canvasMedia.id);
            assert.equal(storedCue.endCanvasMediaId, canvasMedia.id);
            assert.equal(storedCue.startTime, 1500);
            assert.equal(storedCue.endTime, 4500);
            assert.equal(storedCue.startPosition, 22);
            assert.equal(storedCue.endPosition, 88);
            assert.equal(storedCue.volume, 0.7);
        } finally {
            await dataSource.destroy();
        }
    });

    it('moves a cue to another character-linked track when targetTrackId is provided', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue move product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue move episode',
                })
            );
            const [sourceCharacter, targetCharacter] = await dataSource.manager.save([
                new Character({
                    productId: product.id,
                    name: 'Cue move source character',
                }),
                new Character({
                    productId: product.id,
                    name: 'Cue move target character',
                }),
            ]);
            const [sourceTrack, targetTrack] = await dataSource.manager.save([
                new Track({
                    episodeId: episode.id,
                    name: 'Cue move source track',
                    type: 'record',
                    characterId: sourceCharacter.id,
                }),
                new Track({
                    episodeId: episode.id,
                    name: 'Cue move target track',
                    type: 'record',
                    characterId: targetCharacter.id,
                }),
            ]);
            const script = await dataSource.manager.save(new Script({ line: '이동 전 대사', duration: 1200 }));
            const cue = await dataSource.manager.save(
                new Cue({
                    scriptId: script.id,
                    characterId: sourceCharacter.id,
                    trackId: sourceTrack.id,
                    startTime: 1000,
                    endTime: 2200,
                    startPosition: 20,
                    endPosition: 20,
                    volume: 0.9,
                })
            );
            const cueService = createCueService(dataSource);

            await cueService.update({
                trackId: sourceTrack.id,
                cueId: cue.id,
                targetTrackId: targetTrack.id,
                script: '이동 후 대사',
                duration: 1800,
                startTime: 1000,
                endTime: 2800,
                startPosition: 45,
                endPosition: 45,
            });

            const movedCue = await dataSource.manager.findOneOrFail(Cue, {
                where: { id: cue.id },
                relations: { scriptRef: true },
            });
            const sourceTrackCueCount = await dataSource.manager.count(Cue, { where: { trackId: sourceTrack.id } });
            const targetTrackCueCount = await dataSource.manager.count(Cue, { where: { trackId: targetTrack.id } });

            assert.equal(movedCue.id, cue.id);
            assert.equal(movedCue.trackId, targetTrack.id);
            assert.equal(movedCue.characterId, targetCharacter.id);
            assert.equal(movedCue.scriptRef?.line, '이동 후 대사');
            assert.equal(movedCue.scriptRef?.duration, 1800);
            assert.equal(movedCue.startTime, 1000);
            assert.equal(movedCue.endTime, 2800);
            assert.equal(movedCue.startPosition, 45);
            assert.equal(movedCue.endPosition, 45);
            assert.equal(movedCue.volume, 0.9);
            assert.equal(sourceTrackCueCount, 0);
            assert.equal(targetTrackCueCount, 1);
        } finally {
            await dataSource.destroy();
        }
    });

    it('splits an audio cue into two cues that share audioId with separate source ranges', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue split product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue split episode',
                })
            );
            const audio = await dataSource.manager.save(
                new Audio({
                    episodeId: episode.id,
                    audioType: 'audio',
                    name: 'long-voice.wav',
                    audioUrl: 'https://assets.example.com/long-voice.wav',
                    duration: 10000,
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue split track',
                    type: 'audio',
                })
            );
            const script = await dataSource.manager.save(new Script({ line: '긴 오디오 큐' }));
            const cue = await dataSource.manager.save(
                new Cue({
                    scriptId: script.id,
                    trackId: track.id,
                    audioId: audio.id,
                    startTime: 1000,
                    endTime: 9000,
                    audioStartTime: 2000,
                    audioEndTime: 10000,
                    volume: 0.9,
                })
            );
            const cueService = createCueService(dataSource);

            const result = await cueService.split({
                trackId: track.id,
                cueId: cue.id,
                splitTime: 5000,
            });
            const storedCues = await dataSource.manager.find(Cue, {
                where: {
                    trackId: track.id,
                    audioId: audio.id,
                },
                order: {
                    startTime: 'ASC',
                },
            });

            assert.equal(result.left.id, cue.id);
            assert.notEqual(result.right.id, cue.id);
            assert.equal(storedCues.length, 2);
            assert.deepEqual(
                storedCues.map((item) => ({
                    id: item.id,
                    audioId: item.audioId,
                    startTime: item.startTime,
                    endTime: item.endTime,
                    audioStartTime: item.audioStartTime,
                    audioEndTime: item.audioEndTime,
                    volume: item.volume,
                })),
                [
                    {
                        id: cue.id,
                        audioId: audio.id,
                        startTime: 1000,
                        endTime: 5000,
                        audioStartTime: 2000,
                        audioEndTime: 6000,
                        volume: 0.9,
                    },
                    {
                        id: result.right.id,
                        audioId: audio.id,
                        startTime: 5000,
                        endTime: 9000,
                        audioStartTime: 6000,
                        audioEndTime: 10000,
                        volume: 0.9,
                    },
                ]
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('soft deletes a cue by track and cue id', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue delete product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue delete episode',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Cue delete character',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue delete track',
                    type: 'record',
                    characterId: character.id,
                })
            );
            const cue = await dataSource.manager.save(
                new Cue({
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 1000,
                    endTime: 3000,
                })
            );
            const cueService = createCueService(dataSource);

            await cueService.delete({ trackId: track.id, cueId: cue.id });

            const storedCues = await dataSource.manager.find(Cue, {
                where: {
                    id: cue.id,
                },
            });
            const [deletedCue] = await dataSource.manager.find(Cue, {
                where: {
                    id: cue.id,
                },
                withDeleted: true,
            });
            assert.equal(storedCues.length, 0);
            assert.ok(deletedCue.deletedAt);
        } finally {
            await dataSource.destroy();
        }
    });

    it('soft deletes the linked script when the deleted cue is the only active reference', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue script delete product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue script delete episode',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Cue script delete character',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue script delete track',
                    type: 'record',
                    characterId: character.id,
                })
            );
            const script = await dataSource.manager.save(new Script({ line: '삭제할 스크립트' }));
            const cue = await dataSource.manager.save(
                new Cue({
                    scriptId: script.id,
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 1000,
                    endTime: 3000,
                })
            );
            const cueService = createCueService(dataSource);

            await cueService.delete({ trackId: track.id, cueId: cue.id });

            const storedScripts = await dataSource.manager.find(Script, {
                where: {
                    id: script.id,
                },
            });
            const [deletedScript] = await dataSource.manager.find(Script, {
                where: {
                    id: script.id,
                },
                withDeleted: true,
            });
            assert.equal(storedScripts.length, 0);
            assert.ok(deletedScript.deletedAt);
        } finally {
            await dataSource.destroy();
        }
    });

    it('keeps the linked script when another active cue still references it', async () => {
        const dataSource = await createCueServiceDataSource();

        try {
            const product = await dataSource.manager.save(new Product({ title: 'Cue shared script product' }));
            const episode = await dataSource.manager.save(
                new Episode({
                    productId: product.id,
                    episodeNumber: 1,
                    title: 'Cue shared script episode',
                })
            );
            const character = await dataSource.manager.save(
                new Character({
                    productId: product.id,
                    name: 'Cue shared script character',
                })
            );
            const track = await dataSource.manager.save(
                new Track({
                    episodeId: episode.id,
                    name: 'Cue shared script track',
                    type: 'record',
                    characterId: character.id,
                })
            );
            const script = await dataSource.manager.save(new Script({ line: '공유 스크립트' }));
            const [firstCue, secondCue] = await dataSource.manager.save([
                new Cue({
                    scriptId: script.id,
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 1000,
                    endTime: 3000,
                }),
                new Cue({
                    scriptId: script.id,
                    characterId: character.id,
                    trackId: track.id,
                    startTime: 4000,
                    endTime: 6000,
                }),
            ]);
            const cueService = createCueService(dataSource);

            await cueService.delete({ trackId: track.id, cueId: firstCue.id });

            const storedScript = await dataSource.manager.findOneByOrFail(Script, { id: script.id });
            const storedCue = await dataSource.manager.findOneByOrFail(Cue, { id: secondCue.id });
            assert.equal(storedScript.line, '공유 스크립트');
            assert.equal(storedCue.scriptId, script.id);
        } finally {
            await dataSource.destroy();
        }
    });
});
