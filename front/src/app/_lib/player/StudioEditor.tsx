"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { saveTimelineItemTimings } from "./studioDraft";
import type { TimelineItemTimingUpdate } from "./studioDraft";
import type { PlayerDraft } from "./playerDraft.types";
import type { PlayerManifest, TimelineItemManifest } from "./playerManifest.types";
import { moveTimelineItemByPixels } from "./timelineDrag";

const playbackButtons = ["first", "prev", "play_all", "play", "stop", "next", "last"];
const historyButtons = ["load-temporal", "undo", "redo"];
const checkboxes = [
  "시간 따라가기",
  "스크립트 라인 표시",
  "마커 표시",
  "화면 효과 표시",
  "객체 정보 표시",
  "오디오 트랙 확장",
  "TTS 파형 보이기",
];

export function StudioEditor({
  apiBaseUrl,
  episodeId,
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
  const [isMuted, setIsMuted] = useState(false);
  const dragRef = useRef<{
    itemId: string;
    originX: number;
    originItem: TimelineItemManifest;
  } | null>(null);

  const product = initialDraft.products[0];
  const episode = initialDraft.episodes[0];
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
  const cueItemByCueId = useMemo(
    () =>
      new Map(
        items
          .filter((item) => item.kind === "cue" && item.cueId)
          .map((item) => [item.cueId!, item]),
      ),
    [items],
  );
  const selectedItem = items.find((item) => item.id === selectedItemId);
  const selectedCue = selectedItem?.cueId ? cueById.get(selectedItem.cueId) : undefined;
  const selectedScript = selectedCue ? scriptsById.get(selectedCue.scriptId) : undefined;
  const imagePanels = initialDraft.media
    .filter((media) => media.kind === "image")
    .map((media) => ({
      media,
      renderedHeight: Math.max(260, Math.round((media.naturalHeight ?? 1200) / 3)),
    }));
  const timelineDurationMs = Math.max(1, durationMs);
  const totalImageHeight = Math.max(
    1,
    imagePanels.reduce((sum, panel) => sum + panel.renderedHeight, 0),
  );
  const markerRows = initialDraft.cues.map((cue, index) => {
    const item = cueItemByCueId.get(cue.id);
    const top = Math.round(
      ((item?.startTime ?? cue.startTime) / timelineDurationMs) * totalImageHeight,
    );
    return {
      cue,
      index,
      item,
      top: Math.min(totalImageHeight - 2, Math.max(0, top)),
    };
  });
  const selectedCueRecords = selectedCue
    ? initialDraft.records.filter((record) => record.cueId === selectedCue.id)
    : [];
  const titleParts = [
    product?.title,
    episode?.title,
    episode?.episodeNumber != null ? `${episode.episodeNumber}화` : undefined,
  ].filter(Boolean);
  const pageTitle = `화면 연출관리${titleParts.length ? ` : ${titleParts.join(" - ")}` : ""}`;

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

  const endItemDrag = () => {
    dragRef.current = null;
  };

  useEffect(() => {
    const updateItemDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === drag.itemId
            ? moveTimelineItemByPixels({
                item: drag.originItem,
                deltaPixels: event.clientX - drag.originX,
                durationMs,
              })
            : item,
        ),
      );
      setSaveState("idle");
    };

    window.addEventListener("pointermove", updateItemDrag);
    window.addEventListener("pointerup", endItemDrag);
    window.addEventListener("pointercancel", endItemDrag);

    return () => {
      window.removeEventListener("pointermove", updateItemDrag);
      window.removeEventListener("pointerup", endItemDrag);
      window.removeEventListener("pointercancel", endItemDrag);
    };
  }, [durationMs]);

  const updates: TimelineItemTimingUpdate[] = items.map((item) => ({
    itemId: item.id,
    startTime: item.startTime,
    endTime: item.endTime,
  }));

  const saveDraft = async () => {
    if (!apiBaseUrl) return;
    setSaveState("saving");
    try {
      const manifest = await saveTimelineItemTimings({
        apiBaseUrl,
        episodeId,
        updates,
        fallbackDraft: initialDraft,
      });
      setItems(manifest.items);
      setDurationMs(manifest.durationMs);
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
  };

  return (
    <div className="fit column direction-main">
      <div>
        <div className="common-title" data-testid="dubright-common-title">
          {pageTitle}
        </div>
      </div>

      <div className="col row full-width direction-body">
        <section className="base-shortcut-focus full-height toon-focus">
          <div className="image-type-selector">
            <button className="active" type="button">원본 이미지</button>
            <button type="button">교체 이미지</button>
          </div>
          <div className="image-editor-selector">
            <button type="button">이미지 편집</button>
            <span>{imagePanels.length} images</span>
          </div>
          <div className="toon-box">
            <div className="toon-box-header">
              <span>{episode?.title ?? episodeId}</span>
              <small>scale 1.0</small>
            </div>
            <div className="toon-content-box">
              <div id="toon-overlay">
                {markerRows.map(({ cue, index, item, top }) => (
                  <button
                    className={`horizontal-line spoint ${selectedItemId === item?.id ? "selected" : ""}`}
                    key={cue.id}
                    onClick={() => item && setSelectedItemId(item.id)}
                    style={{ top }}
                    type="button"
                  >
                    <span className="horizontal-line-delete">x</span>
                    <span className="horizontal-line-indicator">
                      {String(index + 1).padStart(3, "0")}
                    </span>
                  </button>
                ))}
                {imagePanels.map(({ media, renderedHeight }, index) => (
                  <figure
                    className="toon-image"
                    key={media.id}
                    style={{ height: renderedHeight }}
                  >
                    <div className="toon-image-placeholder">
                      <strong>{index + 1}</strong>
                      <span>{media.id}</span>
                    </div>
                  </figure>
                ))}
                <div id="toon-overlay-fade-effect" />
              </div>
            </div>
          </div>
        </section>

        <section className="base-shortcut-focus col tool-box column bg-primary">
          <div className="q-splitter fit">
            <div className="q-splitter__before">
              <div className="script-box column no-wrap fit q-px-sm">
                <div className="header">
                  <div>전체 스크립트</div>
                  <div className="btns">
                    <button className="script-toggle-btn" type="button">
                      스크립트 닫기
                    </button>
                  </div>
                </div>
                <div className="content col column no-wrap">
                  <div className="content-tr row content-header">
                    <div>번호</div>
                    <div>캐릭터</div>
                    <div className="col">대사</div>
                  </div>
                  <div className="col scripts">
                    {[...initialDraft.scripts]
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((script, index) => {
                        const cue = initialDraft.cues.find(
                          (candidate) => candidate.scriptId === script.id,
                        );
                        const item = cue ? cueItemByCueId.get(cue.id) : undefined;
                        const character = charactersById.get(script.characterId);
                        return (
                          <button
                            className={`content-tr row full-width script-tr ${selectedItemId === item?.id ? "highlight" : ""}`}
                            data-script-uuid={script.id}
                            key={script.id}
                            onClick={() => item && setSelectedItemId(item.id)}
                            type="button"
                          >
                            <div>{index + 1}</div>
                            <div className="custom-ellipsis">{character?.name ?? "-"}</div>
                            <div className="custom-ellipsis col">{script.text}</div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            <div className="q-splitter__separator" />

            <div className="q-splitter__after">
              <div className="fit column after-workspace">
                <div className="row tool-options-box">
                  <div className="tool-marker-box row">
                    <div className="col marker-button-column">
                      <div className="row marker-buttons">
                        <button className="b-btn default-box" type="button">
                          ＋ 마커 생성
                        </button>
                        <button className="b-btn default-box" type="button">
                          캐릭터 추가
                        </button>
                      </div>
                    </div>
                    <div className="col">
                      <button
                        className="b-btn mute-button"
                        onClick={() => setIsMuted((value) => !value)}
                        type="button"
                      >
                        {isMuted ? "음소거 해제" : "전체 음소거"}
                      </button>
                    </div>
                  </div>

                  <div className="col column toolbar-column">
                    <div className="col row justify-between toolbar-row">
                      <div className="row toolbar-left">
                        <button className="b-btn" type="button">
                          마커 자동 생성
                        </button>
                        <button className="b-btn" type="button">
                          마커 위치 일괄 조정
                        </button>
                        <button className="b-btn" type="button">
                          마커 비율 조정
                        </button>
                        <button className="b-btn" type="button">
                          캐스팅
                        </button>
                        <button className="b-btn" type="button">
                          자동지정
                        </button>
                        <div className="toolbar-buttons-right">
                          {historyButtons.map((button) => (
                            <button className="toolbar-button" key={button} type="button">
                              {button}
                            </button>
                          ))}
                        </div>
                        <button className="toolbar-button-contentdata" type="button">
                          {"{}"}
                        </button>
                      </div>
                      <div className="col row items-center justify-end playback-row">
                        <div className="toolbar-buttons-right">
                          {playbackButtons.map((button) => (
                            <button className="toolbar-button" key={button} type="button">
                              {button}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="col row items-end justify-between effect-row">
                      <div className="row effect-controls">
                        <select className="white-box" defaultValue="">
                          <option value="" disabled>
                            화면 효과
                          </option>
                          <option>바운딩</option>
                          <option>페이드 인</option>
                          <option>페이드 아웃</option>
                        </select>
                        <button className="b-btn" type="button">추가</button>
                        <button className="b-btn add-audio" type="button">
                          ＋ 오디오 추가
                        </button>
                        <div className="work-space-checkboxes">
                          {checkboxes.map((label, index) => (
                            <label className="checkbox-item" key={label}>
                              <input defaultChecked={index < 5} type="checkbox" />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col full-width workspace-col">
                  <div id="workspace-wrapper">
                    <section id="voice-work-space-main">
                      <div id="voice-work-space">
                        <div className="time-line">
                          <div className="timeline-info-width">TimeLine</div>
                          <div className="timeline-ruler">
                            {[0, 2, 4, 6, 8, 10, 12].map((second) => (
                              <span key={second}>{second}s</span>
                            ))}
                          </div>
                        </div>

                        <div id="tracks">
                          {initialManifest.tracks.map((track) => {
                            const trackItems = items
                              .filter((item) => item.trackId === track.id)
                              .sort((a, b) => a.startTime - b.startTime);
                            return (
                              <div
                                className={`voice-track-box ${track.kind}-track`}
                                key={track.id}
                              >
                                <div className="voice-track-info">
                                  <strong>{track.name}</strong>
                                  <span>{track.kind}</span>
                                </div>
                                <div className="voice-track-lane">
                                  {trackItems.map((item) => {
                                    const left = Math.max(
                                      0,
                                      (item.startTime / timelineDurationMs) * 100,
                                    );
                                    const width = Math.max(
                                      6,
                                      ((item.endTime - item.startTime) / timelineDurationMs) *
                                        100,
                                    );
                                    return (
                                      <button
                                        className={`clip clip-${item.kind} ${selectedItemId === item.id ? "selected" : ""}`}
                                        data-testid={`timeline-item-${item.id}`}
                                        key={item.id}
                                        onClick={() => setSelectedItemId(item.id)}
                                        onPointerCancel={endItemDrag}
                                        onPointerDown={(event) => startItemDrag(event, item)}
                                        onPointerUp={endItemDrag}
                                        style={{
                                          left: `${left}%`,
                                          width: `${Math.min(width, 100 - left)}%`,
                                        }}
                                        type="button"
                                      >
                                        <strong>{item.kind}</strong>
                                        <span>{item.id}</span>
                                        <small>{item.startTime}ms - {item.endTime}ms</small>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div id="pinlines">
                          {markerRows.map(({ cue, index, item }) => (
                            <button
                              className="time-line-pin spoint-pin"
                              key={cue.id}
                              onClick={() => item && setSelectedItemId(item.id)}
                              style={{
                                left: `${
                                  ((item?.startTime ?? cue.startTime) /
                                    timelineDurationMs) *
                                  100
                                }%`,
                              }}
                              type="button"
                            >
                              {index + 1}
                            </button>
                          ))}
                          <div id="pin_current_pos" />
                        </div>
                      </div>

                      <div id="fake-scrollbar">
                        <div id="fake-scrollbar-inner" />
                      </div>

                      <aside className="object-info">
                        <h2>ObjectInfo</h2>
                        {selectedItem ? (
                          <div className="object-info-grid">
                            <label>
                              uuid
                              <input readOnly value={selectedItem.id} />
                            </label>
                            <label>
                              start
                              <input
                                min={0}
                                onChange={(event) =>
                                  updateSelectedItem({
                                    ...selectedItem,
                                    startTime: Number(event.target.value),
                                  })
                                }
                                type="number"
                                value={selectedItem.startTime}
                              />
                            </label>
                            <label>
                              end
                              <input
                                min={selectedItem.startTime + 1}
                                onChange={(event) =>
                                  updateSelectedItem({
                                    ...selectedItem,
                                    endTime: Number(event.target.value),
                                  })
                                }
                                type="number"
                                value={selectedItem.endTime}
                              />
                            </label>
                            <button
                              className="b-btn"
                              onClick={() =>
                                updateSelectedItem({
                                  ...selectedItem,
                                  startTime: selectedItem.startTime + 500,
                                  endTime: selectedItem.endTime + 500,
                                })
                              }
                              type="button"
                            >
                              +500ms
                            </button>
                          </div>
                        ) : null}
                        {selectedCue ? (
                          <div className="cue-summary">
                            <strong>{selectedCue.id}</strong>
                            <span>{selectedScript?.text ?? ""}</span>
                            {selectedCueRecords.map((record) => (
                              <small key={record.id}>{record.status} · {record.id}</small>
                            ))}
                          </div>
                        ) : null}
                      </aside>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="bottom-btn-box">
        <div>
          <button className="b-btn bg-primary" type="button">임시 저장</button>
        </div>
        <div>
          <button
            className="b-btn"
            disabled={!apiBaseUrl || saveState === "saving"}
            onClick={saveDraft}
            type="button"
          >
            저장 <span className="sr-only">Save</span>
          </button>
        </div>
        <div>
          <button className="b-btn" type="button">연출 완료<br />(검수제출)</button>
        </div>
        <div>
          <button className="b-btn bg-dub-gray" type="button">나가기</button>
        </div>
        <div>
          <button className="b-btn bg-red" type="button">삭제</button>
        </div>
        <strong className="save-state">{saveState}</strong>
      </div>
    </div>
  );
}
