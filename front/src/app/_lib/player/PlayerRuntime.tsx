'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

const PLAYER_DURATION_SECONDS = 72;
const PLAYER_TIMELINE_PX_PER_SECOND = 15;

type PlayerTrackType = 'scroll' | 'voice' | 'audio' | 'sub';
type PlayerEffectId = 'fadeIn' | 'fadeOut';
type PlayerIconName = 'bolt' | 'image' | 'mic' | 'music' | 'pause' | 'play' | 'quote' | 'text' | 'wave';

type PlayerVisual = {
    id: string;
    kind: 'cut' | 'video';
    start: number;
    duration: number;
    height: number;
    label: string;
    background: string;
    bubble?: {
        text: string;
        tone?: 'default' | 'right' | 'narration';
    };
    subtitle?: string;
    effects?: PlayerEffectId[];
};

type PlayerScrollEvent = {
    id: string;
    start: number;
    end: number;
    y0: number;
    y1: number;
    label: string;
    effects?: PlayerEffectId[];
};

type PlayerTrack = {
    id: string;
    name: string;
    color: string;
    type: PlayerTrackType;
    icon?: PlayerIconName;
};

type PlayerClip = {
    id: string;
    track: string;
    start: number;
    duration: number;
    label: string;
    subtitle: string;
    characterId?: string;
    effects?: PlayerEffectId[];
};

const playerCharacters = new Map([
    ['jihu', { name: '지후', color: '#5b9bff' }],
    ['seora', { name: '세라', color: '#f472b6' }],
    ['teacher', { name: '담임 선생님', color: '#34d399' }],
]);

const playerTracks: PlayerTrack[] = [
    { id: 'scroll', name: '스크롤', color: 'var(--tdp-visual)', type: 'scroll', icon: 'image' },
    { id: 'jihu', name: '지후 녹음', color: '#5b9bff', type: 'voice', icon: 'mic' },
    { id: 'seora', name: '세라 녹음', color: '#f472b6', type: 'voice', icon: 'mic' },
    { id: 'teacher', name: '담임 녹음', color: '#34d399', type: 'voice', icon: 'mic' },
    { id: 'na', name: 'NA', color: 'var(--tdp-na)', type: 'audio', icon: 'quote' },
    { id: 'sub', name: '자막', color: 'var(--tdp-sub)', type: 'sub', icon: 'text' },
    { id: 'bgm', name: 'BGM', color: 'var(--tdp-bgm)', type: 'audio', icon: 'music' },
    { id: 'sfx', name: 'SFX', color: 'var(--tdp-sfx)', type: 'audio', icon: 'wave' },
];

const playerClips: PlayerClip[] = [
    { id: 'v1', track: 'jihu', start: 2, duration: 5, characterId: 'jihu', label: '지후', subtitle: '"또 늦었네... 1교시부터 망했다."' },
    { id: 'v2', track: 'seora', start: 9, duration: 4, characterId: 'seora', label: '세라', subtitle: '"너 진짜 매일 지각이야?"' },
    { id: 'v3', track: 'teacher', start: 16, duration: 6, characterId: 'teacher', label: '담임', subtitle: '"전학생이 한 명 더 있다."', effects: ['fadeIn'] },
    { id: 'v4', track: 'jihu', start: 30, duration: 5, characterId: 'jihu', label: '지후', subtitle: '"저 눈빛... 어디서 봤더라."' },
    { id: 'v5', track: 'seora', start: 48, duration: 6, characterId: 'seora', label: '세라', subtitle: '"설마... 그날 옥상의 그 애?"' },
    { id: 'v6', track: 'teacher', start: 58, duration: 5, characterId: 'teacher', label: '담임', subtitle: '"조용히. 수업 시작한다."' },
    { id: 'na1', track: 'na', start: 0, duration: 6, label: 'NA · 오프닝', subtitle: '"평범했던 학원의 아침이었다."' },
    { id: 'na2', track: 'na', start: 24, duration: 5, label: 'NA · 전환', subtitle: '"그리고 모든 게 바뀌었다."' },
    { id: 'na3', track: 'na', start: 56, duration: 8, label: 'NA · 엔딩', subtitle: '"비밀은 이제 막 시작됐다."' },
    { id: 's1', track: 'sub', start: 2, duration: 5, label: 'EN', subtitle: 'Late again... first period is ruined.' },
    { id: 's2', track: 'sub', start: 9, duration: 4, label: 'EN', subtitle: 'Are you really late every day?' },
    { id: 's3', track: 'sub', start: 16, duration: 6, label: 'EN', subtitle: 'We have one more transfer student.' },
    { id: 's4', track: 'sub', start: 48, duration: 6, label: 'EN', subtitle: 'Could it be... the rooftop kid?' },
    { id: 'b1', track: 'bgm', start: 0, duration: 34, label: 'Morning Calm', subtitle: 'Lo-fi loop' },
    { id: 'b2', track: 'bgm', start: 34, duration: 38, label: 'Tension Rising', subtitle: 'Strings build', effects: ['fadeOut'] },
    { id: 'x1', track: 'sfx', start: 5, duration: 2, label: '발소리', subtitle: 'footsteps' },
    { id: 'x2', track: 'sfx', start: 24, duration: 3, label: '두근거림', subtitle: 'heartbeat' },
    { id: 'x3', track: 'sfx', start: 38, duration: 2, label: '유리 깨짐', subtitle: 'glass' },
    { id: 'x4', track: 'sfx', start: 54, duration: 2, label: '바람', subtitle: 'wind gust' },
];

const playerVisuals: PlayerVisual[] = [
    {
        id: 'c1',
        kind: 'cut',
        start: 0,
        duration: 8,
        height: 248,
        label: '컷 01',
        background: 'linear-gradient(160deg,#2b3a67,#16213e)',
        bubble: { text: '평범했던 학원의 아침이었다.', tone: 'narration' },
    },
    {
        id: 'c2',
        kind: 'cut',
        start: 8,
        duration: 8,
        height: 300,
        label: '컷 02',
        background: 'linear-gradient(160deg,#5a3a52,#2a1a2e)',
        bubble: { text: '또 늦었네... 1교시부터 망했다.' },
    },
    {
        id: 'c3',
        kind: 'cut',
        start: 16,
        duration: 10,
        height: 336,
        label: '컷 03',
        background: 'linear-gradient(160deg,#3a5a4a,#16261e)',
        bubble: { text: '너 진짜 매일 지각이야?', tone: 'right' },
        subtitle: '"Are you really late every day?"',
        effects: ['fadeIn'],
    },
    {
        id: 'vid',
        kind: 'video',
        start: 26,
        duration: 9,
        height: 220,
        label: '삽입 영상 · 회상씬',
        background: 'linear-gradient(135deg,#2a1a4e,#101a3e)',
    },
    {
        id: 'c4',
        kind: 'cut',
        start: 35,
        duration: 9,
        height: 264,
        label: '컷 04',
        background: 'linear-gradient(160deg,#67503a,#2e2416)',
        bubble: { text: '전학생이 한 명 더 있다.' },
    },
    {
        id: 'c5',
        kind: 'cut',
        start: 44,
        duration: 10,
        height: 312,
        label: '컷 05',
        background: 'linear-gradient(160deg,#3a4a67,#16203e)',
        bubble: { text: '저 눈빛... 어디서 봤더라.', tone: 'right' },
        effects: ['fadeOut'],
    },
    {
        id: 'c6',
        kind: 'cut',
        start: 54,
        duration: 18,
        height: 420,
        label: '컷 06',
        background: 'linear-gradient(160deg,#52324a,#26161f)',
        bubble: { text: '비밀은 이제 막 시작됐다.', tone: 'narration' },
    },
];

const playerScrollEvents: PlayerScrollEvent[] = [
    { id: 's1', start: 0, end: 9, y0: 0, y1: 300, label: '오프닝 팬', effects: ['fadeIn'] },
    { id: 's2', start: 9, end: 17, y0: 300, y1: 300, label: '지후 대사 · 고정' },
    { id: 's3', start: 17, end: 24, y0: 300, y1: 884, label: '장면 전환' },
    { id: 's4', start: 24, end: 33, y0: 884, y1: 1104, label: '회상 영상' },
    { id: 's5', start: 33, end: 41, y0: 1104, y1: 1104, label: '세라 등장 · 고정' },
    { id: 's6', start: 41, end: 50, y0: 1104, y1: 1680, label: '긴장 고조' },
    { id: 's7', start: 50, end: 62, y0: 1680, y1: 2100, label: '엔딩 팬', effects: ['fadeOut'] },
];

const playerEffectLabels = new Map<PlayerEffectId, string>([
    ['fadeIn', '페이드 인'],
    ['fadeOut', '페이드 아웃'],
]);

const playerIconPaths: Record<PlayerIconName, ReactNode> = {
    bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6z" />,
    image: (
        <>
            <rect height="18" rx="2" width="18" x="3" y="3" />
            <path d="m3 15 5-5 4 4 3-3 6 6" />
            <circle cx="8.5" cy="8.5" r="1.5" />
        </>
    ),
    mic: (
        <>
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
            <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
        </>
    ),
    music: (
        <>
            <path d="M9 18V6l10-2v12" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="16" cy="16" r="3" />
        </>
    ),
    pause: <path d="M7 5h4v14H7zM13 5h4v14h-4z" />,
    play: <path d="M8 5v14l11-7z" />,
    quote: <path d="M7 7h4v4c0 2-1 3-3 4M14 7h4v4c0 2-1 3-3 4" />,
    text: <path d="M4 6h16M4 6V4h16v2M9 6v14m6-14v14" />,
    wave: <path d="M3 12h2l2-7 3 14 3-10 2 5h6" />,
};

function PlayerIcon({ name, size = 16 }: { name: PlayerIconName; size?: number }) {
    return (
        <svg aria-hidden="true" className="tdp-icon" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size}>
            {playerIconPaths[name]}
        </svg>
    );
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function formatPlayerTime(seconds: number) {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = Math.floor(safeSeconds % 60);

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function isClipActive(clip: PlayerClip, playhead: number) {
    return playhead >= clip.start && playhead < clip.start + clip.duration;
}

function getEventDuration(event: PlayerScrollEvent) {
    return Math.max(0, event.end - event.start);
}

function getActiveScrollEvent(playhead: number) {
    return (
        playerScrollEvents.find((event) => playhead >= event.start && playhead < event.end) ??
        playerScrollEvents[playerScrollEvents.length - 1]!
    );
}

function getScrollYAt(playhead: number) {
    const event = getActiveScrollEvent(playhead);
    const duration = getEventDuration(event) || 0.001;
    const progress = clamp((playhead - event.start) / duration, 0, 1);

    return event.y0 + (event.y1 - event.y0) * progress;
}

function getActiveEffects(scrollEvent: PlayerScrollEvent, activeClips: PlayerClip[]) {
    const effectIds = new Set<PlayerEffectId>();

    scrollEvent.effects?.forEach((effectId) => effectIds.add(effectId));
    activeClips.forEach((clip) => clip.effects?.forEach((effectId) => effectIds.add(effectId)));

    return Array.from(effectIds);
}

function getStripTotalHeight() {
    return playerVisuals.reduce((total, visual) => total + visual.height, 0);
}

function getStripTransform(scrollY: number) {
    const maxScroll = Math.max(0, getStripTotalHeight() - 620);

    return `translateY(-${clamp(scrollY, 0, maxScroll)}px)`;
}

function getEventDirection(event: PlayerScrollEvent) {
    const deltaY = event.y1 - event.y0;

    if (Math.abs(deltaY) < 1) {
        return '고정';
    }

    return deltaY > 0 ? '아래로 스크롤' : '위로 스크롤';
}

function getClipStyle(start: number, duration: number): CSSProperties {
    return {
        left: `${start * PLAYER_TIMELINE_PX_PER_SECOND}px`,
        width: `${duration * PLAYER_TIMELINE_PX_PER_SECOND}px`,
    };
}

function getScrollOverlayStyle(event: PlayerScrollEvent): CSSProperties {
    const hold = Math.abs(event.y1 - event.y0) < 1;
    const top = hold ? Math.max(0, event.y0 - 18) : Math.min(event.y0, event.y1);
    const height = hold ? 36 : Math.max(42, Math.abs(event.y1 - event.y0));

    return {
        top: `${top}px`,
        height: `${height}px`,
    };
}

function renderTimelineWave(clip: PlayerClip) {
    if (clip.track === 'sub') {
        return null;
    }

    return (
        <span className="tdp-clip-wave">
            {Array.from({ length: Math.max(8, Math.round(clip.duration * 3)) }, (_, index) => (
                <i key={`${clip.id}-${index}`} style={{ height: `${18 + Math.abs(Math.sin(index * 1.7 + clip.start)) * 72}%` }} />
            ))}
        </span>
    );
}

export function PlayerRuntime({ episodeId }: { episodeId: string }) {
    const [playhead, setPlayhead] = useState(14);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [speedPercent, setSpeedPercent] = useState(100);
    const [volumePercent, setVolumePercent] = useState(82);
    const activeScrollEvent = useMemo(() => getActiveScrollEvent(playhead), [playhead]);
    const activeClips = useMemo(() => playerClips.filter((clip) => isClipActive(clip, playhead)), [playhead]);
    const activeVoice = activeClips.find((clip) => clip.characterId) ?? activeClips.find((clip) => clip.track === 'na');
    const activeSubtitle = activeClips.find((clip) => clip.track === 'sub');
    const activeSfxClips = activeClips.filter((clip) => clip.track === 'sfx');
    const activeEffects = useMemo(() => getActiveEffects(activeScrollEvent, activeClips), [activeClips, activeScrollEvent]);
    const scrollY = getScrollYAt(playhead);
    const timelineWidth = PLAYER_DURATION_SECONDS * PLAYER_TIMELINE_PX_PER_SECOND;

    useEffect(() => {
        if (!isPlaying) {
            return undefined;
        }

        let animationFrame = 0;
        let previousTimestamp = performance.now();

        const tick = (timestamp: number) => {
            const elapsedSeconds = ((timestamp - previousTimestamp) / 1000) * (speedPercent / 100);
            previousTimestamp = timestamp;

            setPlayhead((current) => {
                const next = current + elapsedSeconds;

                if (next >= PLAYER_DURATION_SECONDS) {
                    if (isLooping) {
                        return 0;
                    }

                    setIsPlaying(false);
                    return PLAYER_DURATION_SECONDS;
                }

                return next;
            });

            animationFrame = requestAnimationFrame(tick);
        };

        animationFrame = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(animationFrame);
    }, [isLooping, isPlaying, speedPercent]);

    const handleSetHead = (seconds: number) => {
        setPlayhead(clamp(seconds, 0, PLAYER_DURATION_SECONDS));
    };

    return (
        <div className="tdp-player" data-testid="tooned-player-runtime">
            <header className="tdp-topbar">
                <div className="tdp-brand">
                    <span className="tdp-mark">
                        <PlayerIcon name="bolt" size={16} />
                    </span>
                    <span>Tooned Player</span>
                </div>
                <div className="tdp-project">
                    <b>{episodeId === 'sample-player' ? '학원 로맨스 EP.01' : episodeId}</b>
                    <span />
                    <em>세로 웹툰 영상</em>
                    <span />
                    <strong>{isPlaying ? 'playing' : 'ready'}</strong>
                </div>
                <div className="tdp-top-spacer" />
                <span className="tdp-pill">
                    렌더 <b>1080x1920</b>
                </span>
                <span className="tdp-pill">
                    오디오 <b>8 tracks</b>
                </span>
                <a className="tdp-link-btn" href="/studio/products/4/episodes/1">
                    에디터로
                </a>
            </header>

            <main className="tdp-main">
                <aside className="tdp-side">
                    <div className="tdp-panel-head">
                        <h2>재생 큐</h2>
                        <p>타임라인 시점에 따라 스크롤 이벤트가 자동 적용됩니다.</p>
                    </div>
                    <div className="tdp-panel-body">
                        <div className="tdp-now-card">
                            <div className="tdp-now-kicker">Current scroll event</div>
                            <div className="tdp-now-title">{activeScrollEvent.label}</div>
                            <div className="tdp-now-meta">
                                {formatPlayerTime(activeScrollEvent.start)}-{formatPlayerTime(activeScrollEvent.end)} · {getEventDirection(activeScrollEvent)}
                            </div>
                            <div className="tdp-scroll-meter">
                                <i style={{ width: `${clamp((playhead - activeScrollEvent.start) / (getEventDuration(activeScrollEvent) || 1), 0, 1) * 100}%` }} />
                            </div>
                        </div>
                        <div className="tdp-section-label">Scroll events</div>
                        <div className="tdp-event-list">
                            {playerScrollEvents.map((event) => (
                                <button className={`tdp-event-item ${event.id === activeScrollEvent.id ? 'is-active' : ''}`} key={event.id} onClick={() => handleSetHead(event.start)} type="button">
                                    <span className="tdp-event-time">{formatPlayerTime(event.start)}</span>
                                    <span>
                                        <span className="tdp-event-name">{event.label}</span>
                                        <span className="tdp-event-dir">
                                            {getEventDirection(event)} · {getEventDuration(event).toFixed(1)}s
                                        </span>
                                    </span>
                                    <span className="tdp-event-chip">{Math.abs(event.y1 - event.y0) < 1 ? 'HOLD' : 'MOVE'}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                <section className="tdp-stage">
                    <div className="tdp-viewer-wrap">
                        <div className="tdp-canvas" aria-label="웹툰 영상 플레이어">
                            <div className="tdp-canvas-bar">
                                <span>IMAGE STRIP PLAYER · 스크롤 결과 검수</span>
                                <span className="tdp-dots">
                                    <i />
                                    <i />
                                    <i />
                                </span>
                            </div>
                            <div className="tdp-strip-scroll">
                                <div className="tdp-strip" style={{ transform: getStripTransform(scrollY) }}>
                                    {playerVisuals.map((visual) =>
                                        visual.kind === 'video' ? (
                                            <article className="tdp-video-cut" key={visual.id} style={{ height: `${visual.height}px`, background: visual.background }}>
                                                <div className="tdp-video-label">
                                                    <PlayerIcon name="image" size={15} />
                                                    {visual.label}
                                                </div>
                                                <div className="tdp-video-play">
                                                    <PlayerIcon name="play" size={18} />
                                                </div>
                                            </article>
                                        ) : (
                                            <article className="tdp-cut" key={visual.id} style={{ height: `${visual.height}px`, background: visual.background }}>
                                                <span className="tdp-cut-index">{visual.label}</span>
                                                {visual.bubble ? <p className={`tdp-bubble tdp-bubble-${visual.bubble.tone ?? 'default'}`}>{visual.bubble.text}</p> : null}
                                                {visual.subtitle ? <span className="tdp-cut-subtitle">{visual.subtitle}</span> : null}
                                            </article>
                                        ),
                                    )}
                                </div>
                                <div className="tdp-strip-event-overlay" style={{ height: `${getStripTotalHeight()}px`, transform: getStripTransform(scrollY) }}>
                                    {playerScrollEvents.map((event) => (
                                        <button className={`tdp-sev ${event.id === activeScrollEvent.id ? 'is-active' : ''} ${Math.abs(event.y1 - event.y0) < 1 ? 'is-hold' : ''}`} key={event.id} onClick={() => handleSetHead(event.start)} style={getScrollOverlayStyle(event)} type="button">
                                            <span className="tdp-sev-dot tdp-sev-start" />
                                            <span className="tdp-sev-dot tdp-sev-end" />
                                            <span className="tdp-sev-label">{event.label}</span>
                                            <span className="tdp-sev-meta">
                                                {formatPlayerTime(event.start)}-{formatPlayerTime(event.end)} · {getEventDirection(event)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <div className="tdp-strip-playhead" style={{ top: '45%' }}>
                                    <span>현재 {formatPlayerTime(playhead)}</span>
                                </div>
                            </div>
                            <div className={`tdp-fx-layer ${activeEffects.includes('fadeIn') ? 'is-fade-in' : ''} ${activeEffects.includes('fadeOut') ? 'is-fade-out' : ''}`} />
                        </div>
                    </div>
                    <div className="tdp-subtitle-band">
                        <div className="tdp-subtitle">
                            <div className="tdp-speaker">{activeVoice?.characterId ? playerCharacters.get(activeVoice.characterId)?.name : activeVoice ? '내레이션' : '대기 중'}</div>
                            <div className="tdp-line">{activeVoice ? activeVoice.subtitle.replace(/^"|"$/g, '') : '현재 시점에 활성 녹음이 없습니다.'}</div>
                            <div className="tdp-translation">{activeSubtitle?.subtitle ?? '번역 자막 없음'}</div>
                        </div>
                        <div className="tdp-active-fx">
                            {activeEffects.map((effectId) => (
                                <span className="tdp-fx-pill" key={effectId}>
                                    <i />
                                    {playerEffectLabels.get(effectId)}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                <aside className="tdp-side tdp-side-right">
                    <div className="tdp-panel-head">
                        <h2>오디오 레이어</h2>
                        <p>녹음, 내레이션, BGM, 효과음을 재생 시점 기준으로 모니터링합니다.</p>
                    </div>
                    <div className="tdp-panel-body">
                        <div className="tdp-section-label">Live mix</div>
                        <div className="tdp-mix-list">
                            {playerTracks.filter((track) => track.id !== 'scroll').map((track) => {
                                const activeClip = activeClips.find((clip) => clip.track === track.id);

                                return (
                                    <div className={`tdp-mix-row ${activeClip ? 'is-active' : ''}`} key={track.id} style={{ '--tdp-row-color': track.color } as CSSProperties}>
                                        <div className="tdp-mix-top">
                                            <span className="tdp-mix-icon">
                                                <PlayerIcon name={track.icon ?? 'wave'} size={16} />
                                            </span>
                                            <div className="tdp-mix-copy">
                                                <div className="tdp-mix-name">{track.name}</div>
                                                <div className="tdp-mix-sub">{activeClip ? activeClip.subtitle : '대기'}</div>
                                            </div>
                                            <span className="tdp-mix-state">{activeClip ? 'ON' : 'OFF'}</span>
                                        </div>
                                        <div className="tdp-meter">
                                            {Array.from({ length: 18 }, (_, index) => (
                                                <i key={`${track.id}-${index}`} style={{ '--tdp-i': index, height: `${18 + Math.abs(Math.sin(index * 1.5 + (activeClip ? playhead : 0))) * 62}%` } as CSSProperties} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </aside>
            </main>

            <footer className="tdp-bottom">
                <section className="tdp-controls">
                    <div className="tdp-transport-row">
                        <button className="tdp-ctrl-btn" onClick={() => handleSetHead(playhead - 5)} title="5초 뒤로" type="button">
                            -5
                        </button>
                        <button className="tdp-play-btn" onClick={() => setIsPlaying((current) => !current)} title="재생" type="button">
                            <PlayerIcon name={isPlaying ? 'pause' : 'play'} size={20} />
                        </button>
                        <button className="tdp-ctrl-btn" onClick={() => handleSetHead(playhead + 5)} title="5초 앞으로" type="button">
                            +5
                        </button>
                        <button className={`tdp-ctrl-btn ${isLooping ? 'is-on' : ''}`} onClick={() => setIsLooping((current) => !current)} title="반복 재생" type="button">
                            LOOP
                        </button>
                        <div className="tdp-time-read">
                            <b>{formatPlayerTime(playhead)}</b> <span>/ {formatPlayerTime(PLAYER_DURATION_SECONDS)}</span>
                        </div>
                    </div>
                    <label className="tdp-range-row">
                        <span>속도</span>
                        <input max={150} min={50} onChange={(event) => setSpeedPercent(Number(event.target.value))} type="range" value={speedPercent} />
                    </label>
                    <label className="tdp-range-row">
                        <span>볼륨</span>
                        <input max={100} min={0} onChange={(event) => setVolumePercent(Number(event.target.value))} type="range" value={volumePercent} />
                    </label>
                </section>

                <section className="tdp-timeline-wrap">
                    <div className="tdp-ruler" style={{ width: `${timelineWidth}px` }}>
                        {Array.from({ length: Math.floor(PLAYER_DURATION_SECONDS / 5) + 1 }, (_, index) => index * 5).map((tick) => (
                            <button className="tdp-tick" key={tick} onClick={() => handleSetHead(tick)} style={{ left: `${tick * PLAYER_TIMELINE_PX_PER_SECOND}px` }} type="button">
                                <span>{formatPlayerTime(tick)}</span>
                            </button>
                        ))}
                    </div>
                    <div className="tdp-timeline" style={{ width: `${timelineWidth}px` }}>
                        {playerTracks.map((track) => (
                            <div className={`tdp-track-row ${track.id === 'scroll' ? 'is-visual' : ''}`} key={track.id}>
                                <span className="tdp-track-name">{track.name}</span>
                                {track.id === 'scroll'
                                    ? playerScrollEvents.map((event) => (
                                          <button className={`tdp-timeline-clip ${event.id === activeScrollEvent.id ? 'is-active' : ''}`} key={event.id} onClick={() => handleSetHead(event.start)} style={{ ...getClipStyle(event.start, getEventDuration(event)), '--tdp-clip-color': track.color } as CSSProperties} type="button">
                                              <span>{event.label}</span>
                                          </button>
                                      ))
                                    : playerClips
                                          .filter((clip) => clip.track === track.id)
                                          .map((clip) => (
                                              <button className={`tdp-timeline-clip ${isClipActive(clip, playhead) ? 'is-active' : ''}`} key={clip.id} onClick={() => handleSetHead(clip.start)} style={{ ...getClipStyle(clip.start, clip.duration), '--tdp-clip-color': track.color } as CSSProperties} type="button">
                                                  {renderTimelineWave(clip)}
                                                  <span>{clip.label}</span>
                                              </button>
                                          ))}
                            </div>
                        ))}
                        <div className="tdp-timeline-head" style={{ left: `${playhead * PLAYER_TIMELINE_PX_PER_SECOND}px` }} />
                    </div>
                </section>

                <section className="tdp-right-status">
                    <div className="tdp-export-status">
                        <div>
                            <b>재생 검수</b>
                            <span>{activeScrollEvent.label} · {activeVoice ? `${activeVoice.label} 녹음` : '녹음 없음'} · {activeSfxClips.length ? activeSfxClips.map((clip) => clip.label).join(', ') : '효과음 없음'}</span>
                        </div>
                        <em>SYNC</em>
                    </div>
                    <div className="tdp-mini-grid">
                        <div className="tdp-mini-stat">
                            <span>Scroll Y</span>
                            <b>{Math.round(scrollY)} px</b>
                        </div>
                        <div className="tdp-mini-stat">
                            <span>Active audio</span>
                            <b>{activeClips.filter((clip) => clip.track !== 'sub').length}</b>
                        </div>
                        <div className="tdp-mini-stat">
                            <span>SFX</span>
                            <b>{activeSfxClips.map((clip) => clip.label).join(', ') || '-'}</b>
                        </div>
                        <div className="tdp-mini-stat">
                            <span>Effect</span>
                            <b>{activeEffects.map((effectId) => playerEffectLabels.get(effectId)).join(', ') || '-'}</b>
                        </div>
                    </div>
                </section>
            </footer>
        </div>
    );
}
