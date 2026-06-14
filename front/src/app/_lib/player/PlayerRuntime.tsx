'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { buildPlaybackEvents } from './buildPlaybackEvents';
import type { PlaybackEvent } from './buildPlaybackEvents';
import type { PlayerManifest } from './playerManifest.types';
import { getPreviewScrollOffset, type PreviewScrollVisualSegment } from './previewScrollPosition';
import { buildPlayerScenes, type PlayerScene } from './playerScenes';

type IconName = 'back' | 'mute' | 'pause' | 'play' | 'studio' | 'volume';

const iconPaths: Record<IconName, ReactNode> = {
    back: <path d="m15 18-6-6 6-6" />,
    mute: (
        <>
            <path d="M4 10v4h4l5 4V6L8 10z" />
            <path d="m18 9 3 3m0-3-3 3" />
        </>
    ),
    pause: <path d="M8 5h3v14H8zM13 5h3v14h-3z" />,
    play: <path d="M8 5v14l11-7z" />,
    studio: (
        <>
            <path d="M4 6h16v12H4z" />
            <path d="M8 10h8M8 14h5" />
        </>
    ),
    volume: (
        <>
            <path d="M4 10v4h4l5 4V6L8 10z" />
            <path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" />
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

export function PlayerRuntime({ episodeId, manifest }: { episodeId: string; manifest: PlayerManifest }) {
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const sceneRefs = useRef(new Map<string, HTMLElement>());
    const audioRefs = useRef(new Map<string, HTMLAudioElement>());
    const videoRefs = useRef(new Map<string, HTMLVideoElement>());
    const scenes = useMemo(() => buildPlayerScenes(manifest), [manifest]);
    const scrollEvents = useMemo(
        () =>
            (manifest.scrolls ?? []).map((scroll) => ({
                canvasId: scroll.canvasId,
                start: scroll.startTime,
                duration: Math.max(0, scroll.endTime - scroll.startTime),
                startIndex: scroll.startIndex,
                endIndex: scroll.endIndex,
                startPosition: scroll.startPosition,
                endPosition: scroll.endPosition,
            })),
        [manifest.scrolls],
    );
    const playbackEvents = useMemo(() => buildPlaybackEvents(manifest), [manifest]);
    const durationMs = Math.max(1000, manifest.durationMs, ...scenes.map((scene) => scene.endTime));
    const [playheadMs, setPlayheadMs] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(82);
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
                const next = current + elapsedMs;

                if (next >= durationMs) {
                    if (isLooping) return 0;

                    setIsPlaying(false);
                    return durationMs;
                }

                return next;
            });

            animationFrame = requestAnimationFrame(tick);
        };

        animationFrame = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(animationFrame);
    }, [durationMs, isLooping, isPlaying]);

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller || scrollEvents.length === 0) return;

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
        const nextTop = getPreviewScrollOffset({
            playhead: playheadMs,
            scrollEvents,
            stripHeightPx: scroller.scrollHeight,
            viewportHeightPx: scroller.clientHeight,
            visualSegments,
        });

        if (nextTop === undefined) return;

        scroller.scrollTo({ top: nextTop });
    }, [playheadMs, scenes, scrollEvents]);

    useEffect(() => {
        const activeEventIds = new Set(activeEvents.map((event) => event.id));

        for (const event of playbackEvents) {
            const audio = audioRefs.current.get(event.id);
            if (!audio) continue;

            const isActive = activeEventIds.has(event.id);
            audio.muted = isMuted;
            audio.volume = clamp((event.volume * volume) / 100, 0, 1);

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
    }, [activeEvents, isMuted, isPlaying, playbackEvents, playheadMs, volume]);

    useEffect(() => {
        for (const scene of scenes) {
            if (scene.kind !== 'video') continue;

            const video = videoRefs.current.get(scene.id);
            if (!video) continue;

            if (activeScene?.id !== scene.id) {
                video.pause();
                continue;
            }

            const targetTime = Math.max(0, (playheadMs - scene.startTime) / 1000);
            if (Math.abs(video.currentTime - targetTime) > 0.25) {
                video.currentTime = targetTime;
            }

            if (isPlaying) {
                void video.play().catch(() => undefined);
            } else {
                video.pause();
            }
        }
    }, [activeScene, isPlaying, playheadMs, scenes]);

    useEffect(() => {
        return () => {
            audioRefs.current.forEach((audio) => audio.pause());
            videoRefs.current.forEach((video) => video.pause());
        };
    }, []);

    const seekTo = (milliseconds: number) => {
        setPlayheadMs(clamp(milliseconds, 0, durationMs));
    };

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
                <div className="vpp-scroll" ref={scrollerRef}>
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
                                        muted
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
                    <button className={`vpp-chip-button ${isLooping ? 'is-active' : ''}`} onClick={() => setIsLooping((current) => !current)} type="button">
                        LOOP
                    </button>
                    <button className="vpp-icon-button" onClick={() => setIsMuted((current) => !current)} type="button" aria-label={isMuted ? '음소거 해제' : '음소거'}>
                        <PlayerIcon name={isMuted ? 'mute' : 'volume'} size={19} />
                    </button>
                </div>
                <div className="vpp-progress-row">
                    <span>{formatPlayerTime(playheadMs)}</span>
                    <input max={durationMs} min={0} onChange={(event) => seekTo(Number(event.target.value))} step={100} type="range" value={playheadMs} />
                    <span>{formatPlayerTime(durationMs)}</span>
                </div>
                <div className="vpp-volume-row">
                    <input aria-label="볼륨" max={100} min={0} onChange={(event) => setVolume(Number(event.target.value))} type="range" value={volume} />
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
