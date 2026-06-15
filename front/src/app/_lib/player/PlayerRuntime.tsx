'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { buildPlaybackEvents } from './buildPlaybackEvents';
import type { PlaybackEvent } from './buildPlaybackEvents';
import type { PlayerManifest } from './playerManifest.types';
import { syncPreviewVideoPlayback, type PreviewVideoClip } from './previewVideoPlayback';
import type { PreviewScrollVisualSegment } from './previewScrollPosition';
import {
    advancePlayerRuntimePlayhead,
    getPlayerRuntimePlayheadFromScroll,
    shouldSyncPlayerRuntimeScroll,
    toPlayerRuntimeScrollAnchors,
    toPlayerRuntimeScrollEvents,
} from './playerRuntimeScroll';
import { buildPlayerScenes, type PlayerScene } from './playerScenes';

type IconName = 'back' | 'pause' | 'play' | 'studio';

const iconPaths: Record<IconName, ReactNode> = {
    back: <path d="m15 18-6-6 6-6" />,
    pause: <path d="M8 5h3v14H8zM13 5h3v14h-3z" />,
    play: <path d="M8 5v14l11-7z" />,
    studio: (
        <>
            <path d="M4 6h16v12H4z" />
            <path d="M8 10h8M8 14h5" />
        </>
    ),
};

function PlayerIcon({ name, size = 18 }: { name: IconName; size?: number }) {
    return (
        <svg aria-hidden="true" className="vpp-icon" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size}>
            {iconPaths[name]}
        </svg>
    );
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function formatPlayerTime(milliseconds: number) {
    const safeSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getActiveScene(scenes: PlayerScene[], playheadMs: number) {
    const currentScene = scenes.find((scene) => scene.startTime <= playheadMs && playheadMs < scene.endTime);
    if (currentScene) return currentScene;

    let previousScene = scenes[0];
    for (const scene of scenes) {
        if (scene.startTime <= playheadMs) previousScene = scene;
    }

    return previousScene;
}

function getActivePlaybackEvents(events: PlaybackEvent[], playheadMs: number) {
    return events.filter((event) => event.startTime <= playheadMs && playheadMs < event.endTime);
}

function toSeconds(milliseconds: number | undefined) {
    return typeof milliseconds === 'number' && Number.isFinite(milliseconds) ? milliseconds / 1000 : undefined;
}

function getVideoSceneDurationMs(scene: PlayerScene) {
    const itemDuration = Math.max(0, scene.endTime - scene.startTime);

    if (scene.kind !== 'video') return itemDuration;
    if (scene.hasTimelineControls) return itemDuration;

    if (
        typeof scene.trimStartTime === 'number' &&
        Number.isFinite(scene.trimStartTime) &&
        typeof scene.trimEndTime === 'number' &&
        Number.isFinite(scene.trimEndTime) &&
        scene.trimEndTime > scene.trimStartTime
    ) {
        return scene.trimEndTime - scene.trimStartTime;
    }

    if (typeof scene.mediaDuration === 'number' && Number.isFinite(scene.mediaDuration) && scene.mediaDuration > 0) {
        return scene.mediaDuration;
    }

    return itemDuration;
}

export function PlayerRuntime({ episodeId, manifest }: { episodeId: string; manifest: PlayerManifest }) {
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const sceneRefs = useRef(new Map<string, HTMLElement>());
    const audioRefs = useRef(new Map<string, HTMLAudioElement>());
    const videoRefs = useRef(new Map<string, HTMLVideoElement>());
    const scenes = useMemo(() => buildPlayerScenes(manifest), [manifest]);
    const scrollEvents = useMemo(() => toPlayerRuntimeScrollEvents(manifest.scrolls), [manifest.scrolls]);
    const scrollAnchors = useMemo(() => toPlayerRuntimeScrollAnchors(manifest.anchors), [manifest.anchors]);
    const playbackEvents = useMemo(() => buildPlaybackEvents(manifest), [manifest]);
    const durationMs = Math.max(
        1000,
        manifest.durationMs,
        ...scenes.map((scene) => scene.endTime),
        ...scenes.map((scene) => (scene.kind === 'video' ? scene.startTime + getVideoSceneDurationMs(scene) : 0)),
    );
    const [playheadMs, setPlayheadMs] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const videoClips = useMemo<PreviewVideoClip[]>(
        () =>
            scenes.map((scene) => ({
                id: scene.id,
                kind: scene.kind,
                mediaType: scene.kind,
                mediaUrl: scene.mediaUrl,
                mediaDuration: scene.mediaDuration,
                hasTimelineControls: scene.hasTimelineControls,
                sourceStart: toSeconds(scene.trimStartTime),
                sourceEnd: toSeconds(scene.trimEndTime),
                volume: clamp(scene.volume ?? 1, 0, 1),
                isMuted: scene.isMuted === true,
                start: scene.startTime / 1000,
                duration: getVideoSceneDurationMs(scene) / 1000,
            })),
        [scenes],
    );
    const activeScene = getActiveScene(scenes, playheadMs);
    const activeEvents = getActivePlaybackEvents(playbackEvents, playheadMs);

    useEffect(() => {
        setPlayheadMs((current) => clamp(current, 0, durationMs));
    }, [durationMs]);

    useEffect(() => {
        if (!isPlaying) return undefined;

        let animationFrame = 0;
        let previousTimestamp = performance.now();

        const tick = (timestamp: number) => {
            const elapsedMs = timestamp - previousTimestamp;
            previousTimestamp = timestamp;

            setPlayheadMs((current) => {
                const next = advancePlayerRuntimePlayhead({
                    currentTimeMs: current,
                    elapsedMs,
                    durationMs,
                });

                if (next.isEnded) {
                    setIsPlaying(false);
                }

                return next.playheadMs;
            });

            animationFrame = requestAnimationFrame(tick);
        };

        animationFrame = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(animationFrame);
    }, [durationMs, isPlaying]);

    const syncPlayheadFromScroll = useCallback((scroller: HTMLDivElement | null = scrollerRef.current) => {
        if (!scroller || !shouldSyncPlayerRuntimeScroll(scrollEvents, scrollAnchors)) return;
        const scrollerRect = scroller.getBoundingClientRect();
        const visualSegments: PreviewScrollVisualSegment[] = scenes.flatMap((scene): PreviewScrollVisualSegment[] => {
            const sceneElement = sceneRefs.current.get(scene.id);

            if (!sceneElement) {
                return [];
            }

            const sceneRect = sceneElement.getBoundingClientRect();

            return [
                {
                    id: scene.id,
                    canvasId: scene.canvasId,
                    index: scene.index,
                    top: sceneRect.top - scrollerRect.top + scroller.scrollTop,
                    height: sceneRect.height,
                },
            ];
        });
        setPlayheadMs((current) => {
            const nextPlayheadMs = getPlayerRuntimePlayheadFromScroll({
                scrollTopPx: scroller.scrollTop,
                currentPlayheadMs: current,
                scrollEvents,
                anchors: scrollAnchors,
                stripHeightPx: scroller.scrollHeight,
                viewportHeightPx: scroller.clientHeight,
                visualSegments,
            });

            if (nextPlayheadMs === undefined) return current;

            const next = clamp(nextPlayheadMs, 0, durationMs);

            return Math.abs(current - next) < 16 ? current : next;
        });
    }, [durationMs, scenes, scrollAnchors, scrollEvents]);

    useEffect(() => {
        syncPlayheadFromScroll();
    }, [syncPlayheadFromScroll]);

    useEffect(() => {
        const activeEventIds = new Set(activeEvents.map((event) => event.id));

        for (const event of playbackEvents) {
            const audio = audioRefs.current.get(event.id);
            if (!audio) continue;

            const isActive = activeEventIds.has(event.id);
            audio.muted = false;
            audio.volume = clamp(event.volume, 0, 1);

            if (!isActive) {
                audio.pause();
                if (audio.currentTime > 0) audio.currentTime = 0;
                continue;
            }

            const targetTime = Math.max(0, (playheadMs - event.startTime) / 1000);
            if (Math.abs(audio.currentTime - targetTime) > 0.25) {
                audio.currentTime = targetTime;
            }

            if (isPlaying) {
                void audio.play().catch(() => undefined);
            } else {
                audio.pause();
            }
        }
    }, [activeEvents, isPlaying, playbackEvents, playheadMs]);

    useEffect(() => {
        syncPreviewVideoPlayback({
            clips: videoClips,
            isPlaying,
            playhead: playheadMs / 1000,
            videos: videoRefs.current,
        });
    }, [isPlaying, playheadMs, videoClips]);

    useEffect(() => {
        return () => {
            audioRefs.current.forEach((audio) => audio.pause());
            videoRefs.current.forEach((video) => video.pause());
        };
    }, []);

    const activeLabel =
        activeEvents[0]?.kind === 'record'
            ? '녹음 재생'
            : activeEvents[0]?.kind === 'tts'
              ? 'TTS 재생'
              : activeEvents[0]?.kind === 'audio'
                ? '오디오 재생'
                : '대기 중';

    return (
        <div className="vpp-player" data-testid="tooned-player-runtime">
            <header className="vpp-header">
                <a className="vpp-icon-button" href="/" aria-label="뒤로가기">
                    <PlayerIcon name="back" size={20} />
                </a>
                <div className="vpp-title">
                    <strong>Episode {manifest.episodeId || episodeId}</strong>
                    <span>{formatPlayerTime(playheadMs)} / {formatPlayerTime(durationMs)}</span>
                </div>
                <a className="vpp-icon-button" href={`/studio/products/1/episodes/${manifest.episodeId || episodeId}`} aria-label="에디터로">
                    <PlayerIcon name="studio" size={19} />
                </a>
            </header>

            <main className="vpp-stage">
                <div className="vpp-scroll" onScroll={(event) => syncPlayheadFromScroll(event.currentTarget)} ref={scrollerRef}>
                    <div className="vpp-work">
                        {scenes.map((scene) => (
                            <section
                                className={`vpp-scene is-${scene.kind}`}
                                key={scene.id}
                                ref={(node) => {
                                    if (node) {
                                        sceneRefs.current.set(scene.id, node);
                                    } else {
                                        sceneRefs.current.delete(scene.id);
                                    }
                                }}
                                style={{ '--vpp-scene-height': `${scene.height}px`, '--vpp-scene-bg': scene.background } as CSSProperties}
                            >
                                {scene.kind === 'image' && scene.mediaUrl ? <img alt="" className="vpp-media" src={scene.mediaUrl} /> : null}
                                {scene.kind === 'video' && scene.mediaUrl ? (
                                    <video
                                        className="vpp-media"
                                        playsInline
                                        preload="metadata"
                                        ref={(node) => {
                                            if (node) {
                                                videoRefs.current.set(scene.id, node);
                                            } else {
                                                videoRefs.current.delete(scene.id);
                                            }
                                        }}
                                        src={scene.mediaUrl}
                                    />
                                ) : null}
                                {scene.kind === 'placeholder' ? (
                                    <div className="vpp-placeholder">
                                        <span>{scene.label}</span>
                                        <strong>{scene.mediaId ? `MEDIA ${scene.mediaId}` : 'VISUAL DATA EMPTY'}</strong>
                                    </div>
                                ) : null}
                                <div className="vpp-scene-label">
                                    <span>{scene.label}</span>
                                    <small>{formatPlayerTime(scene.startTime)} - {formatPlayerTime(scene.endTime)}</small>
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            </main>

            <footer className="vpp-controls">
                <div className="vpp-control-main">
                    <button className="vpp-play-button" onClick={() => setIsPlaying((current) => !current)} type="button" aria-label={isPlaying ? '일시정지' : '재생'}>
                        <PlayerIcon name={isPlaying ? 'pause' : 'play'} size={22} />
                    </button>
                    <div className="vpp-now">
                        <strong>{activeLabel}</strong>
                        <span>{activeScene?.label ?? 'SCENE'} · {activeEvents[0]?.url ?? '오디오 없음'}</span>
                    </div>
                </div>
            </footer>

            <div aria-hidden="true" className="vpp-audio-bank">
                {playbackEvents.map((event) => (
                    <audio
                        key={event.id}
                        preload="auto"
                        ref={(node) => {
                            if (node) {
                                audioRefs.current.set(event.id, node);
                            } else {
                                audioRefs.current.delete(event.id);
                            }
                        }}
                        src={event.url}
                    />
                ))}
            </div>
        </div>
    );
}
