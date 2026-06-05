"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import type { PlayerDraft } from "./playerDraft.types";
import type { PlayerManifest, TimelineItemManifest } from "./playerManifest.types";
import { moveTimelineItemByPixels } from "./timelineDrag";

const timelineScaleOptions = [
  "80 px/s",
  "120 px/s",
  "160 px/s",
  "220 px/s",
] as const;

type TimelineScale = (typeof timelineScaleOptions)[number];

type PanelId = "fx" | "char" | "assets" | "audio" | "text" | "settings";

type IconName =
  | "asset"
  | "bolt"
  | "caption"
  | "download"
  | "effect"
  | "fullscreen"
  | "image"
  | "lock"
  | "mic"
  | "music"
  | "play"
  | "quote"
  | "search"
  | "settings"
  | "speaker"
  | "text"
  | "wave";

const panelDefs: Array<{
  id: PanelId;
  label: string;
  icon: IconName;
  title: string;
  description: string;
}> = [
  {
    id: "fx",
    label: "효과",
    icon: "effect",
    title: "특수효과",
    description: "클립 위로 드래그하거나 클릭해 효과를 적용하세요.",
  },
  {
    id: "char",
    label: "캐릭터",
    icon: "mic",
    title: "캐릭터 보이스",
    description: "캐릭터별 음성을 관리하고 대사 레이어에 배치합니다.",
  },
  {
    id: "assets",
    label: "컷",
    icon: "image",
    title: "웹툰 컷",
    description: "세로 스트립을 구성하는 컷과 삽입 영상을 관리합니다.",
  },
  {
    id: "audio",
    label: "사운드",
    icon: "music",
    title: "사운드",
    description: "BGM과 효과음 라이브러리.",
  },
  {
    id: "text",
    label: "자막",
    icon: "text",
    title: "자막 · 번역",
    description: "대사를 자동 번역해 자막 트랙에 배치합니다.",
  },
  {
    id: "settings",
    label: "설정",
    icon: "settings",
    title: "프로젝트 설정",
    description: "캔버스와 내보내기 옵션.",
  },
];

const effectLibrary = [
  {
    id: "fadeIn",
    name: "페이드 인",
    description: "서서히 나타나기",
    icon: "effect" as const,
  },
  {
    id: "fadeOut",
    name: "페이드 아웃",
    description: "서서히 사라지기",
    icon: "bolt" as const,
  },
  {
    id: "zoom",
    name: "줌 인",
    description: "컷 중심 확대",
    icon: "fullscreen" as const,
  },
  {
    id: "shake",
    name: "충격 흔들림",
    description: "효과음 구간 강조",
    icon: "wave" as const,
  },
];

const cutGradients = [
  "linear-gradient(160deg,#2b3a67,#16213e)",
  "linear-gradient(160deg,#5a3a52,#2a1a2e)",
  "linear-gradient(160deg,#3a5a4a,#16261e)",
  "linear-gradient(160deg,#67503a,#2e2416)",
  "linear-gradient(160deg,#3a4a67,#16203e)",
  "linear-gradient(160deg,#52324a,#26161f)",
];

const mockAudioClips = [
  {
    id: "mock-bgm-main",
    startTime: 0,
    endTime: 34000,
    label: "Morning Calm",
    subLabel: "Lo-fi · loop",
  },
  {
    id: "mock-bgm-rise",
    startTime: 34000,
    endTime: 72000,
    label: "Tension Rising",
    subLabel: "Strings · build",
  },
];

const soundLibrary = [
  ["Morning Calm", "Lo-fi · 0:34", "music"],
  ["Tension Rising", "Strings · 0:38", "music"],
  ["발소리", "SFX · 0:02", "wave"],
  ["두근거림", "SFX · 0:03", "wave"],
] as const satisfies ReadonlyArray<readonly [string, string, IconName]>;

const displayOptionDefs = [
  { key: "snap", label: "스냅", defaultChecked: true },
  { key: "markers", label: "마커 표시", defaultChecked: true },
  { key: "effects", label: "화면 효과 표시", defaultChecked: true },
  { key: "waveform", label: "TTS 파형 보이기", defaultChecked: true },
] as const;

type DisplayOptionKey = (typeof displayOptionDefs)[number]["key"];

const trackColors = {
  voice: "#5b9bff",
  na: "#2dd4bf",
  sub: "#fbbf24",
  bgm: "#34d399",
  sfx: "#f472b6",
  visual: "#a78bfa",
};

const trackHeaderWidth = 172;

interface MockClip {
  id: string;
  startTime: number;
  endTime: number;
  label: string;
  subLabel: string;
}

interface EditorTrackRow {
  id: "voice" | "na" | "sub" | "bgm" | "sfx" | "visual";
  name: string;
  sub: string;
  color: string;
  icon: IconName;
  isVisual?: boolean;
  items: TimelineItemManifest[];
  mockClips: MockClip[];
}

export function StudioEditor({
  initialDraft,
  initialManifest,
}: {
  apiBaseUrl?: string;
  episodeId: string;
  initialDraft: PlayerDraft;
  initialManifest: PlayerManifest;
}) {
  const [items, setItems] = useState(initialManifest.items);
  const [durationMs, setDurationMs] = useState(initialManifest.durationMs);
  const [selectedItemId, setSelectedItemId] = useState(initialManifest.items[0]?.id);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [activePanelId, setActivePanelId] = useState<PanelId>("fx");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(14000);
  const [timelineScale, setTimelineScale] = useState<TimelineScale>("80 px/s");
  const [displayOptions, setDisplayOptions] = useState<Record<DisplayOptionKey, boolean>>(
    () =>
      Object.fromEntries(
        displayOptionDefs.map((option) => [option.key, option.defaultChecked]),
      ) as Record<DisplayOptionKey, boolean>,
  );
  const [appliedEffects, setAppliedEffects] = useState<Record<string, string[]>>({});
  const dragRef = useRef<{
    itemId: string;
    originX: number;
    originItem: TimelineItemManifest;
  } | null>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);

  const product = initialDraft.products[0];
  const episode = initialDraft.episodes[0];
  const activePanel = panelDefs.find((panel) => panel.id === activePanelId) ?? panelDefs[0];
  const timelineDurationMs = Math.max(1, durationMs);
  const secondsDuration = Math.ceil(timelineDurationMs / 1000);
  const pxPerSecond = Number(timelineScale.match(/^\d+/)?.[0] ?? 80);
  const timelineWidth = Math.max(960, Math.ceil((timelineDurationMs / 1000) * pxPerSecond));
  const selectedItem = items.find((item) => item.id === selectedItemId);

  const charactersById = useMemo(
    () => new Map(initialDraft.characters.map((character) => [character.id, character])),
    [initialDraft.characters],
  );
  const scriptsById = useMemo(
    () => new Map(initialDraft.scripts.map((script) => [script.id, script])),
    [initialDraft.scripts],
  );
  const cueById = useMemo(
    () => new Map(initialDraft.cues.map((cue) => [cue.id, cue])),
    [initialDraft.cues],
  );
  const selectedCue = selectedItem?.cueId ? cueById.get(selectedItem.cueId) : undefined;
  const selectedScript = selectedCue ? scriptsById.get(selectedCue.scriptId) : undefined;
  const selectedCharacter = selectedCue
    ? charactersById.get(selectedCue.characterId)
    : undefined;
  const selectedCueRecords = selectedCue
    ? initialDraft.records.filter((record) => record.cueId === selectedCue.id)
    : [];

  const cueItemByCueId = useMemo(
    () =>
      new Map(
        items
          .filter((item) => item.kind === "cue" && item.cueId)
          .map((item) => [item.cueId!, item]),
      ),
    [items],
  );

  const cueItems = useMemo(
    () =>
      items
        .filter((item) => item.kind === "cue")
        .slice()
        .sort((a, b) => a.startTime - b.startTime),
    [items],
  );

  const guideCharacterIds = useMemo(
    () =>
      new Set(
        initialDraft.characters
          .filter((character) => /해설|내레이션|na/i.test(character.name))
          .map((character) => character.id),
      ),
    [initialDraft.characters],
  );

  const previewCuts = useMemo(() => {
    const scriptCuts = initialDraft.scripts.map((script, index) => ({
      id: `preview-cut-${script.id}`,
      label: `컷 ${String(index + 1).padStart(2, "0")}`,
      text: script.text,
      gradient: cutGradients[index % cutGradients.length],
      height: 150 + ((index % 3) + 1) * 28,
      alignRight: index % 2 === 1,
      narration: guideCharacterIds.has(script.characterId),
    }));

    return [
      ...scriptCuts.slice(0, 2),
      {
        id: "preview-video-insert",
        label: "삽입 영상 · 회상씬",
        text: "flashback_rooftop.mp4",
        gradient: "linear-gradient(135deg,#2a1a4e,#101a3e)",
        height: 210,
        alignRight: false,
        narration: false,
        isVideo: true,
      },
      ...scriptCuts.slice(2),
    ];
  }, [guideCharacterIds, initialDraft.scripts]);

  const editorRows = useMemo<EditorTrackRow[]>(() => {
    const voiceItems = cueItems.filter((item) => {
      const cue = item.cueId ? cueById.get(item.cueId) : undefined;
      return cue ? !guideCharacterIds.has(cue.characterId) : true;
    });
    const narrationItems = cueItems.filter((item) => {
      const cue = item.cueId ? cueById.get(item.cueId) : undefined;
      return cue ? guideCharacterIds.has(cue.characterId) : false;
    });
    const subtitleClips = cueItems.map((item) => {
      const cue = item.cueId ? cueById.get(item.cueId) : undefined;
      const script = cue ? scriptsById.get(cue.scriptId) : undefined;

      return {
        id: `subtitle-${item.id}`,
        startTime: item.startTime,
        endTime: item.endTime,
        label: "EN",
        subLabel: script?.text ?? item.id,
      };
    });

    return [
      {
        id: "voice",
        name: "캐릭터 보이스",
        sub: "대사 · TTS",
        color: trackColors.voice,
        icon: "mic",
        items: voiceItems,
        mockClips: [],
      },
      {
        id: "na",
        name: "내레이션 (NA)",
        sub: "해설",
        color: trackColors.na,
        icon: "quote",
        items: narrationItems,
        mockClips: [],
      },
      {
        id: "sub",
        name: "번역 자막",
        sub: "EN · multi-lang",
        color: trackColors.sub,
        icon: "text",
        items: [],
        mockClips: subtitleClips,
      },
      {
        id: "bgm",
        name: "BGM",
        sub: "배경음악",
        color: trackColors.bgm,
        icon: "music",
        items: [],
        mockClips: mockAudioClips,
      },
      {
        id: "sfx",
        name: "SFX / 효과음",
        sub: "효과음",
        color: trackColors.sfx,
        icon: "wave",
        items: items
          .filter((item) => item.kind === "effect")
          .slice()
          .sort((a, b) => a.startTime - b.startTime),
        mockClips: [],
      },
      {
        id: "visual",
        name: "비주얼",
        sub: "웹툰 컷 · 영상 삽입",
        color: trackColors.visual,
        icon: "image",
        isVisual: true,
        items: items
          .filter((item) => item.kind === "visual")
          .slice()
          .sort((a, b) => a.startTime - b.startTime),
        mockClips: [],
      },
    ];
  }, [cueById, cueItems, guideCharacterIds, items, scriptsById]);

  const markerRows = initialDraft.cues.map((cue, index) => {
    const item = cueItemByCueId.get(cue.id);
    return {
      cue,
      index,
      item,
      left: ((item?.startTime ?? cue.startTime) / timelineDurationMs) * timelineWidth,
    };
  });

  const endItemDrag = () => {
    dragRef.current = null;
  };

  const finishItemDragAtClientX = (clientX: number) => {
    updateItemDragFromClientX(clientX);
    endItemDrag();
  };

  const updateItemDragFromClientX = (clientX: number) => {
    const drag = dragRef.current;
    if (!drag) return;

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === drag.itemId
          ? moveTimelineItemByPixels({
              item: drag.originItem,
              deltaPixels: clientX - drag.originX,
              durationMs,
            })
          : item,
      ),
    );
    setSaveState("idle");
  };

  const titleParts = [
    product?.title,
    episode?.title,
    episode?.episodeNumber != null ? `${episode.episodeNumber}화` : undefined,
  ].filter(Boolean);
  const pageTitle = `화면 연출관리${titleParts.length ? ` : ${titleParts.join(" - ")}` : ""}`;

  useEffect(() => {
    if (!isPlaying) return;

    let frameId = 0;
    let lastTime = performance.now();
    const tick = (time: number) => {
      setPlayheadMs((current) => {
        const next = Math.min(timelineDurationMs, current + (time - lastTime));
        if (next >= timelineDurationMs) {
          setIsPlaying(false);
        }
        return next;
      });
      lastTime = time;
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, timelineDurationMs]);

  useEffect(() => {
    const scroller = previewScrollRef.current;
    if (!scroller) return;

    const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollTop = (playheadMs / timelineDurationMs) * maxScrollTop;
  }, [playheadMs, timelineDurationMs]);

  useEffect(() => {
    const updateItemDrag = (event: PointerEvent | MouseEvent) => {
      updateItemDragFromClientX(event.clientX);
    };
    const finishItemDrag = (event: PointerEvent | MouseEvent) => {
      finishItemDragAtClientX(event.clientX);
    };

    window.addEventListener("pointermove", updateItemDrag);
    window.addEventListener("pointerup", finishItemDrag);
    window.addEventListener("pointercancel", endItemDrag);
    window.addEventListener("mousemove", updateItemDrag);
    window.addEventListener("mouseup", finishItemDrag);

    return () => {
      window.removeEventListener("pointermove", updateItemDrag);
      window.removeEventListener("pointerup", finishItemDrag);
      window.removeEventListener("pointercancel", endItemDrag);
      window.removeEventListener("mousemove", updateItemDrag);
      window.removeEventListener("mouseup", finishItemDrag);
    };
  }, [durationMs]);

  const updateSelectedItem = (nextItem: TimelineItemManifest) => {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === nextItem.id ? nextItem : item)),
    );
    setSaveState("idle");
  };

  const startItemDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    item: TimelineItemManifest,
  ) => {
    dragRef.current = {
      itemId: item.id,
      originX: event.clientX,
      originItem: item,
    };
    setSelectedItemId(item.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const startItemMouseDrag = (
    event: ReactMouseEvent<HTMLButtonElement>,
    item: TimelineItemManifest,
  ) => {
    dragRef.current = {
      itemId: item.id,
      originX: event.clientX,
      originItem: item,
    };
    setSelectedItemId(item.id);
    event.preventDefault();
  };

  const toggleDisplayOption = (key: DisplayOptionKey) => {
    setDisplayOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const applyEffect = (effectId: string) => {
    if (!selectedItemId) return;

    setAppliedEffects((current) => {
      const effectIds = current[selectedItemId] ?? [];
      if (effectIds.includes(effectId)) return current;

      return {
        ...current,
        [selectedItemId]: [...effectIds, effectId],
      };
    });
  };

  const seekByMs = (deltaMs: number) => {
    setPlayheadMs((current) => Math.min(timelineDurationMs, Math.max(0, current + deltaMs)));
  };

  const selectedEffectNames = (selectedItemId ? appliedEffects[selectedItemId] ?? [] : []).flatMap(
    (effectId) => {
      const effect = effectLibrary.find((item) => item.id === effectId);
      return effect ? [effect.name] : [];
    },
  );

  return (
    <div className="od-studio dub-studio-app direction-main">
      <header className="od-topbar" data-testid="dubright-common-title">
        <span className="sr-only">{pageTitle}</span>
        <div className="od-brand">
          <span className="od-brand-mark">
            <Icon name="asset" />
          </span>
          Tooned
        </div>

        <div className="od-project">
          <span className="od-project-name">{product?.title ?? "test-player"}</span>
          <span className="od-dot" />
          <span>1080x2400</span>
          <span className="od-dot" />
          <span className="od-saved">
            {saveState === "saving"
              ? "저장 중"
              : saveState === "failed"
                ? "저장 실패"
                : "자동 저장됨"}
          </span>
        </div>

        <nav className="od-menu" aria-label="studio menu">
          <button type="button">파일</button>
          <button type="button">편집</button>
          <button type="button">삽입</button>
          <button type="button">보기</button>
        </nav>

        <div className="od-transport" aria-label="transport controls">
          <button
            aria-label="처음으로"
            className="od-transport-btn"
            onClick={() => setPlayheadMs(0)}
            type="button"
          >
            |&lt;
          </button>
          <button
            aria-label="5초 뒤로"
            className="od-transport-btn"
            onClick={() => seekByMs(-5000)}
            type="button"
          >
            &lt;&lt;
          </button>
          <button
            aria-label="재생"
            className="od-transport-btn od-play-btn"
            onClick={() => setIsPlaying((value) => !value)}
            type="button"
          >
            {isPlaying ? "||" : <Icon name="play" />}
          </button>
          <button
            aria-label="5초 앞으로"
            className="od-transport-btn"
            onClick={() => seekByMs(5000)}
            type="button"
          >
            &gt;&gt;
          </button>
          <span className="od-timecode">
            {formatSeconds(playheadMs / 1000)}
            <span className="od-ms">.{String(Math.floor((playheadMs % 1000) / 10)).padStart(2, "0")}</span>
            <span className="od-total"> / {formatSeconds(secondsDuration)}</span>
          </span>
        </div>

        <div className="od-top-actions">
          <button className="od-ghost-btn" type="button">
            <Icon name="mic" />
            음성 합성
          </button>
          <button className="od-export-btn" type="button">
            <Icon name="download" />
            내보내기
          </button>
          <div className="od-avatar">TP</div>
        </div>
      </header>

      <div className="od-workbench direction-body">
        <nav className="od-rail" aria-label="editor panels">
          {panelDefs.map((panel) => (
            <button
              className={activePanelId === panel.id ? "active" : ""}
              key={panel.id}
              onClick={() => setActivePanelId(panel.id)}
              type="button"
            >
              <Icon name={panel.icon} />
              <span>{panel.label}</span>
            </button>
          ))}
        </nav>

        <aside className="od-library">
          <div className="od-library-head">
            <h2>{activePanel.title}</h2>
            <p>{activePanel.description}</p>
          </div>
          <label className="od-search">
            <Icon name="search" />
            <input placeholder="검색..." />
          </label>
          <div className="od-library-body">
            {renderLibraryPanel({
              activePanelId,
              applyEffect,
              characters: initialDraft.characters,
              media: initialDraft.media,
              selectedItemId,
            })}
          </div>
        </aside>

        <main className="od-stage stage dub-left-preview toon-focus">
          <div className="od-stage-top">
            <div className="od-segmented">
              <button className="active" type="button">미리보기</button>
              <button type="button">컷 편집</button>
              <button type="button">모션</button>
            </div>
            <span className="od-stage-meta">
              <b>비율</b> 9:20 · <b>FPS</b> 30 · <b>현재</b>{" "}
              {selectedItem ? clipTitle(selectedItem, cueById, scriptsById, charactersById) : "컷 01"}
            </span>
          </div>

          <div className="od-preview-wrap toon-content-box">
            <div className="od-canvas">
              <div className="od-canvas-bar">
                <span>PREVIEW · {formatMsClock(playheadMs)}</span>
                <div><i /><i /><i /></div>
              </div>
              <div className="od-strip-scroll" id="toon-overlay" ref={previewScrollRef}>
                <div className="od-strip">
                  {previewCuts.map((cut, index) =>
                    "isVideo" in cut && cut.isVideo ? (
                      <div className="od-video-cut" key={cut.id}>
                        <div className="od-video-frame" style={{ background: cut.gradient }}>
                          <span className="od-video-label">
                            <Icon name="image" />
                            {cut.label}
                          </span>
                          <span className="od-video-play"><Icon name="play" /></span>
                          <span className="od-video-bar"><i /></span>
                        </div>
                      </div>
                    ) : (
                      <figure
                        className="od-cut dub-toon-image"
                        key={cut.id}
                        style={{
                          background: cut.gradient,
                          height: cut.height,
                        }}
                      >
                        <span className="od-cut-index">{cut.label}</span>
                        <figcaption
                          className={
                            cut.narration
                              ? "od-bubble narration"
                              : cut.alignRight
                                ? "od-bubble right"
                                : "od-bubble"
                          }
                        >
                          {cut.text}
                        </figcaption>
                        {index === 1 ? (
                          <span className="od-subtitle">"Are you really late every day?"</span>
                        ) : null}
                      </figure>
                    ),
                  )}
                </div>
              </div>
              <div className="od-fx-overlay">
            {(selectedEffectNames.length ? selectedEffectNames : ["페이드 인"]).slice(0, 2).map((effectName) => (
                  <span key={effectName}>
                    <i />
                    {effectName}
                  </span>
                ))}
              </div>
              <div className="od-preview-float">
                <button aria-label="미리보기 음소거" type="button">
                  <Icon name="speaker" />
                </button>
                <span>스크롤 동기</span>
                <button aria-label="전체화면" type="button">
                  <Icon name="fullscreen" />
                </button>
              </div>
            </div>
          </div>
        </main>

        <aside className="od-inspector object-info">
          {selectedItem ? (
            <SelectedInspector
              appliedEffectNames={selectedEffectNames}
              charactersById={charactersById}
              cueById={cueById}
              item={selectedItem}
              records={selectedCueRecords}
              scriptsById={scriptsById}
              selectedCharacter={selectedCharacter}
              selectedScriptText={selectedScript?.text}
              updateSelectedItem={updateSelectedItem}
            />
          ) : (
            <div className="od-empty-inspector">
              <Icon name="image" />
              <p>타임라인에서 클립을 선택하면 여기서 속성을 편집할 수 있어요.</p>
            </div>
          )}
        </aside>
      </div>

      <section className="od-timeline timeline dub-editor tool-box bg-primary script-box">
        <div className="od-timeline-toolbar tool-options-box">
          <span className="header sr-only">전체 스크립트</span>
          <div className="od-tool-group tool-marker-box">
            <button className="active" type="button" aria-label="선택">
              <Icon name="asset" />
            </button>
            <button type="button" aria-label="자르기">
              <Icon name="bolt" />
            </button>
            <button type="button" aria-label="잠금">
              <Icon name="lock" />
            </button>
          </div>
          <span className="od-divider" />
          <span className="od-timeline-title">
            <b>타임라인</b> · 6 트랙 · 길이 {formatSeconds(secondsDuration)}
          </span>
          <button
            className={`od-snap ${displayOptions.snap ? "active" : ""}`}
            onClick={() => toggleDisplayOption("snap")}
            type="button"
          >
            스냅
          </button>
          <div className="dub-scale-row od-scale-row">
            <label htmlFor="timeline-scale">Time line scale</label>
            <select
              id="timeline-scale"
              onChange={(event) => setTimelineScale(event.target.value as TimelineScale)}
              value={timelineScale}
            >
              {timelineScaleOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="work-space-checkboxes od-display-options">
            {displayOptionDefs.slice(1).map((option) => (
              <label key={option.key}>
                <input
                  checked={displayOptions[option.key]}
                  onChange={() => toggleDisplayOption(option.key)}
                  type="checkbox"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div className="od-timeline-main" id="workspace-wrapper">
          <div className="od-track-heads">
            <div className="od-ruler-corner"><span>트랙</span></div>
            {editorRows.map((row) => (
              <div
                className={`od-track-head dub-track-head ${row.isVisual ? "visual" : ""}`}
                key={row.id}
                style={{ "--od-track-color": row.color } as CSSProperties}
              >
                <span className="od-track-accent" />
                <span className="od-track-icon"><Icon name={row.icon} /></span>
                <span className="od-track-info">
                  <strong>{row.name}</strong>
                  <small>{row.sub}</small>
                </span>
                <span className="od-track-toggles">
                  <button type="button">M</button>
                  <button type="button">S</button>
                  <button type="button"><Icon name="lock" /></button>
                </span>
              </div>
            ))}
          </div>

          <div
            className="od-timeline-scroll"
            id="voice-work-space-main"
            style={{ "--od-timeline-width": `${timelineWidth}px` } as CSSProperties}
          >
            <div className="od-ruler" style={{ width: timelineWidth }}>
              {Array.from({ length: secondsDuration + 1 }, (_, second) => (
                <span
                  className={second % 5 === 0 ? "major" : ""}
                  key={second}
                  style={{ left: second * pxPerSecond }}
                >
                  {second % 5 === 0 ? formatSeconds(second) : ""}
                </span>
              ))}
            </div>

            <div className="od-tracks" style={{ width: timelineWidth }}>
              {markerRows.map(({ cue, index, left }) =>
                displayOptions.markers ? (
                  <button
                    className="od-marker-line dub-marker-line"
                    key={cue.id}
                    onClick={() => {
                      const item = cueItemByCueId.get(cue.id);
                      if (item) setSelectedItemId(item.id);
                    }}
                    style={{ left }}
                    type="button"
                  >
                    <span>{String(index + 1).padStart(3, "0")}</span>
                  </button>
                ) : null,
              )}
              <div
                className="od-playhead"
                style={{ left: (playheadMs / timelineDurationMs) * timelineWidth }}
              />

              {editorRows.map((row) => (
                <div
                  className={`od-track-row ${row.isVisual ? "visual" : ""}`}
                  key={row.id}
                  style={{ "--od-track-color": row.color } as CSSProperties}
                >
                  {row.mockClips.map((clip) => (
                    <div
                      className={`od-clip mock ${row.id}`}
                      key={clip.id}
                      style={clipStyle(clip, timelineDurationMs, timelineWidth)}
                    >
                      {row.id !== "sub" ? <Waveform /> : null}
                      <span className="od-clip-label">{clip.label}</span>
                      <small>{clip.subLabel}</small>
                    </div>
                  ))}

                  {row.items.map((item) => {
                    const itemEffects = appliedEffects[item.id] ?? [];
                    return (
                      <button
                        className={`od-clip dub-timeline-clip ${row.id} dub-clip-${item.kind} ${
                          selectedItemId === item.id ? "selected" : ""
                        }`}
                        data-testid={`timeline-item-${item.id}`}
                        key={item.id}
                        onClick={() => setSelectedItemId(item.id)}
                        onMouseDown={(event) => startItemMouseDrag(event, item)}
                        onMouseMove={(event) => updateItemDragFromClientX(event.clientX)}
                        onPointerCancel={endItemDrag}
                        onPointerDown={(event) => startItemDrag(event, item)}
                        onPointerMove={(event) => updateItemDragFromClientX(event.clientX)}
                        onPointerUp={(event) => finishItemDragAtClientX(event.clientX)}
                        style={{
                          ...clipStyle(item, timelineDurationMs, timelineWidth),
                          zIndex: 10 + item.layerId,
                        }}
                        type="button"
                      >
                        {displayOptions.waveform && !row.isVisual ? <Waveform /> : null}
                        <span className="od-clip-label">
                          {clipTitle(item, cueById, scriptsById, charactersById)}
                        </span>
                        <small>{item.startTime}ms - {item.endTime}ms</small>
                        {displayOptions.effects
                          ? itemEffects.map((effectId, index) => (
                              <span
                                className="od-fx-marker"
                                key={`${item.id}-${effectId}`}
                                style={{ right: 7 + index * 22 }}
                              >
                                <Icon name="bolt" />
                              </span>
                            ))
                          : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="od-statusbar">
          <span><b>선택</b> {selectedItem ? clipTitle(selectedItem, cueById, scriptsById, charactersById) : "-"}</span>
          <span><b>재생헤드</b> {formatSeconds(playheadMs / 1000)}</span>
          <span><b>줌</b> {pxPerSecond} px/s</span>
        </div>
      </section>
    </div>
  );
}

function renderLibraryPanel({
  activePanelId,
  applyEffect,
  characters,
  media,
  selectedItemId,
}: {
  activePanelId: PanelId;
  applyEffect: (effectId: string) => void;
  characters: PlayerDraft["characters"];
  media: PlayerDraft["media"];
  selectedItemId?: string;
}) {
  if (activePanelId === "fx") {
    return (
      <div className="od-fx-grid">
        {effectLibrary.map((effect) => (
          <button
            className={selectedItemId ? "od-fx-card" : "od-fx-card warn"}
            key={effect.id}
            onClick={() => applyEffect(effect.id)}
            type="button"
          >
            <span className="od-fx-icon"><Icon name={effect.icon} /></span>
            <span className="od-card-name">{effect.name}</span>
            <span className="od-card-desc">{effect.description}</span>
          </button>
        ))}
      </div>
    );
  }

  if (activePanelId === "char") {
    return (
      <>
        <div className="od-section-label">출연 캐릭터</div>
        {characters.map((character) => (
          <div className="od-character-row" key={character.id}>
            <span className="od-character-avatar" style={{ background: character.color }}>
              {character.name.slice(0, 1)}
            </span>
            <span className="od-character-meta">
              <strong><i style={{ background: character.color }} />{character.name}</strong>
              <small>{character.defaultTtsVoiceId ?? "voice-unassigned"}</small>
            </span>
            <button type="button" aria-label={`${character.name} 미리듣기`}>
              <Icon name="play" />
            </button>
          </div>
        ))}
        <div className="od-section-label">빠른 작업</div>
        <button className="od-fx-card wide" type="button">
          <span className="od-fx-icon blue"><Icon name="mic" /></span>
          <span className="od-card-name">+ 새 캐릭터 추가</span>
          <span className="od-card-desc">음성 모델을 지정해 대사 트랙을 만듭니다.</span>
        </button>
      </>
    );
  }

  if (activePanelId === "assets") {
    return (
      <>
        <div className="od-section-label">스트립 컷</div>
        <div className="od-asset-grid">
          {media.map((asset, index) => (
            <div className="od-asset" key={asset.id}>
              <div style={{ background: cutGradients[index % cutGradients.length] }} />
              {asset.kind === "video" ? <span className="od-asset-badge">영상</span> : null}
              <span>{asset.id}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (activePanelId === "audio") {
    return (
      <>
        <div className="od-section-label">프로젝트 사운드</div>
        {soundLibrary.map(([name, meta, icon]) => (
          <div className="od-character-row" key={name}>
            <span className="od-sound-icon"><Icon name={icon} /></span>
            <span className="od-character-meta">
              <strong>{name}</strong>
              <small>{meta}</small>
            </span>
            <button type="button" aria-label={`${name} 재생`}><Icon name="play" /></button>
          </div>
        ))}
      </>
    );
  }

  if (activePanelId === "text") {
    return (
      <>
        <div className="od-section-label">자동 번역</div>
        <div className="od-fx-grid">
          <button className="od-fx-card" type="button">
            <span className="od-fx-icon yellow"><Icon name="text" /></span>
            <span className="od-card-name">전체 번역</span>
            <span className="od-card-desc">EN · 자막 생성</span>
          </button>
          <button className="od-fx-card" type="button">
            <span className="od-fx-icon yellow"><Icon name="caption" /></span>
            <span className="od-card-name">자막 스타일</span>
            <span className="od-card-desc">폰트 · 외곽선 · 위치</span>
          </button>
        </div>
        <div className="od-section-label">언어</div>
        <div className="od-chips">
          <button className="active" type="button">English</button>
          <button type="button">日本語</button>
          <button type="button">中文</button>
          <button type="button">Español</button>
        </div>
      </>
    );
  }

  return (
    <div className="od-form-stack">
      <label>
        캔버스 크기
        <select defaultValue="1080 x 2400">
          <option>1080 x 2400</option>
          <option>1080 x 1920</option>
        </select>
      </label>
      <label>
        프레임레이트
        <select defaultValue="30 fps">
          <option>30 fps</option>
          <option>24 fps</option>
          <option>60 fps</option>
        </select>
      </label>
      <label>
        스트립 스크롤 모드
        <select defaultValue="재생헤드 동기">
          <option>재생헤드 동기</option>
          <option>수동 키프레임</option>
        </select>
      </label>
    </div>
  );
}

function SelectedInspector({
  appliedEffectNames,
  charactersById,
  cueById,
  item,
  records,
  scriptsById,
  selectedCharacter,
  selectedScriptText,
  updateSelectedItem,
}: {
  appliedEffectNames: string[];
  charactersById: Map<string, PlayerDraft["characters"][number]>;
  cueById: Map<string, PlayerDraft["cues"][number]>;
  item: TimelineItemManifest;
  records: PlayerDraft["records"];
  scriptsById: Map<string, PlayerDraft["scripts"][number]>;
  selectedCharacter?: PlayerDraft["characters"][number];
  selectedScriptText?: string;
  updateSelectedItem: (item: TimelineItemManifest) => void;
}) {
  const cue = item.cueId ? cueById.get(item.cueId) : undefined;
  const title = clipTitle(item, cueById, scriptsById, charactersById);
  const inspectorColor =
    item.kind === "visual"
      ? trackColors.visual
      : item.kind === "effect"
        ? trackColors.sfx
        : selectedCharacter?.color ?? trackColors.voice;

  return (
    <>
      <div className="od-inspector-head">
        <span style={{ "--od-inspector-color": inspectorColor } as CSSProperties}>
          <Icon name={item.kind === "visual" ? "image" : item.kind === "effect" ? "wave" : "mic"} />
        </span>
        <div>
          <h3>{title}</h3>
          <small>{item.kind} · {formatMsClock(item.startTime)} - {formatMsClock(item.endTime)}</small>
        </div>
      </div>

      <div className="od-inspector-body">
        {item.kind === "cue" ? (
          <>
            <label className="od-field">
              화자 (캐릭터)
              <select defaultValue={selectedCharacter?.name ?? "해설"}>
                <option>{selectedCharacter?.name ?? "해설"}</option>
                <option>지후</option>
                <option>세라</option>
                <option>담임 선생님</option>
              </select>
            </label>
            <label className="od-field">
              대사
              <textarea defaultValue={selectedScriptText ?? title} />
            </label>
            <div className="od-field">
              <span>음성 모델</span>
              <div className="od-chips">
                <button className="active" type="button">{cue?.ttsVoiceId ?? "기본"}</button>
                <button type="button">밝게</button>
                <button type="button">진지하게</button>
                <button type="button">속삭임</button>
              </div>
            </div>
            <div className="od-field">
              <span>파형</span>
              <div className="od-wave-preview"><Waveform /></div>
            </div>
            <div className="od-two-col">
              <label className="od-field">
                속도
                <input defaultValue={100} max={150} min={50} type="range" />
              </label>
              <label className="od-field">
                피치
                <input defaultValue={0} max={12} min={-12} type="range" />
              </label>
            </div>
            {records.length ? (
              <div className="od-records">
                {records.map((record) => (
                  <small key={record.id}>{record.status} · {record.id}</small>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="od-visual-thumb">
              <span>{item.mediaId ?? item.id}</span>
            </div>
            <div className="od-two-col">
              <label className="od-field">
                시작
                <input
                  min={0}
                  onChange={(event) =>
                    updateSelectedItem({
                      ...item,
                      startTime: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={item.startTime}
                />
              </label>
              <label className="od-field">
                길이
                <input readOnly value={`${item.endTime - item.startTime}ms`} />
              </label>
            </div>
            <label className="od-field">
              종료
              <input
                min={item.startTime + 1}
                onChange={(event) =>
                  updateSelectedItem({
                    ...item,
                    endTime: Number(event.target.value),
                  })
                }
                type="number"
                value={item.endTime}
              />
            </label>
            <div className="od-field">
              <span>적용된 효과</span>
              <div className="od-chips">
                {appliedEffectNames.length ? (
                  appliedEffectNames.map((name) => (
                    <button className="active" key={name} type="button">{name}</button>
                  ))
                ) : (
                  <small>없음 - 효과 패널에서 추가</small>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="od-inspector-foot">
        <button type="button">미리듣기</button>
        <button type="button">적용</button>
      </div>
    </>
  );
}

function Waveform() {
  return (
    <span className="od-waveform" aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => (
        <i
          key={index}
          style={{ height: `${24 + Math.abs(Math.sin(index * 1.6)) * 66}%` }}
        />
      ))}
    </span>
  );
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    asset: (
      <>
        <path d="M4 5h16M4 12h10M4 19h16" />
        <circle cx="19" cy="12" r="2.4" />
      </>
    ),
    bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
    caption: <path d="M4 7h16v10H4zM7 11h4M13 11h4M7 14h7" />,
    download: <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
    effect: <path d="m12 2 2.4 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.6-1.5L12 2Z" />,
    fullscreen: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
    image: (
      <>
        <rect height="18" rx="2" width="18" x="3" y="3" />
        <path d="m3 15 5-5 4 4 3-3 6 6" />
        <circle cx="8.5" cy="8.5" r="1.5" />
      </>
    ),
    lock: (
      <>
        <rect height="9" rx="2" width="14" x="5" y="11" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
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
    play: <path d="M8 5v14l11-7-11-7Z" />,
    quote: <path d="M7 7h4v4c0 2-1 3-3 4M14 7h4v4c0 2-1 3-3 4" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4-4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1.4l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.4-1.4l-.3-2.6H9.2l-.3 2.6a7 7 0 0 0-2.4 1.4l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.4 1.4l.3 2.6h2.6l.3-2.6a7 7 0 0 0 2.4-1.4l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12Z" />
      </>
    ),
    speaker: <path d="M5 9v6h4l5 5V4L9 9H5Z" />,
    text: <path d="M4 6h16M4 6V4h16v2M9 6v14m6-14v14M7 20h4m2 0h4" />,
    wave: <path d="M3 12h2l2-7 3 14 3-10 2 5h6" />,
  };

  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function clipTitle(
  item: TimelineItemManifest,
  cueById: Map<string, PlayerDraft["cues"][number]>,
  scriptsById: Map<string, PlayerDraft["scripts"][number]>,
  charactersById: Map<string, PlayerDraft["characters"][number]>,
) {
  if (item.cueId) {
    const cue = cueById.get(item.cueId);
    const script = cue ? scriptsById.get(cue.scriptId) : undefined;
    const character = cue ? charactersById.get(cue.characterId) : undefined;
    return script ? `${character?.name ?? "NA"} · ${script.text}` : item.id;
  }

  return item.mediaId ?? item.id;
}

function clipStyle(
  item: Pick<TimelineItemManifest, "startTime" | "endTime">,
  timelineDurationMs: number,
  timelineWidth: number,
) {
  const left = Math.max(0, (item.startTime / timelineDurationMs) * timelineWidth);
  const width = Math.max(
    72,
    ((item.endTime - item.startTime) / timelineDurationMs) * timelineWidth,
  );

  return {
    left,
    width: Math.min(width, timelineWidth - left),
  };
}

function formatSeconds(value: number) {
  const minutes = String(Math.floor(value / 60)).padStart(2, "0");
  const seconds = String(Math.floor(value % 60)).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatMsClock(value: number) {
  return formatSeconds(value / 1000);
}
