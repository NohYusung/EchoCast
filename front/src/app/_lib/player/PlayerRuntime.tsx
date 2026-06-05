"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  VogopangContent,
  VogopangContentAudioClip,
  VogopangContentHole,
} from "./vogopangContent.types";

function resolveDurationMs(content: VogopangContent): number {
  const spointMax = Math.max(0, ...content.spoints.map((spoint) => spoint.time_ms));
  const holeMax = Math.max(
    0,
    ...content.tracks.flatMap((track) =>
      track.holes.map((hole) => hole.start_ms + hole.duration_ms),
    ),
  );
  const clipMax = Math.max(
    0,
    ...content.audio_tracks.flatMap((track) =>
      track.clips.map((clip) => (clip.start_ms ?? 0) + (clip.duration_ms ?? 0)),
    ),
  );
  return Math.max(spointMax, holeMax, clipMax);
}

function findActiveImageIndex(content: VogopangContent, currentTime: number): number {
  const sorted = [...content.spoints].sort((a, b) => a.time_ms - b.time_ms);
  let activeIndex = 0;
  for (let index = 0; index < sorted.length; index++) {
    if (sorted[index]!.time_ms <= currentTime) {
      activeIndex = index;
    }
  }
  return Math.min(activeIndex, Math.max(0, content.images.length - 1));
}

function collectActiveHoles(
  content: VogopangContent,
  currentTime: number,
): VogopangContentHole[] {
  return content.tracks.flatMap((track) =>
    track.holes.filter(
      (hole) =>
        currentTime >= hole.start_ms &&
        currentTime <= hole.start_ms + hole.duration_ms,
    ),
  );
}

function collectActiveAudioClips(
  content: VogopangContent,
  currentTime: number,
): VogopangContentAudioClip[] {
  return content.audio_tracks.flatMap((track) =>
    track.clips.filter((clip) => {
      const startMs = clip.start_ms ?? 0;
      const durationMs = clip.duration_ms ?? 0;
      return currentTime >= startMs && currentTime <= startMs + durationMs;
    }),
  );
}

export function PlayerRuntime({
  content,
  episodeId,
}: {
  content: VogopangContent;
  episodeId: string;
}) {
  const durationMs = useMemo(() => resolveDurationMs(content), [content]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeImageIndex = useMemo(
    () => findActiveImageIndex(content, currentTime),
    [content, currentTime],
  );
  const activeHoles = useMemo(
    () => collectActiveHoles(content, currentTime),
    [content, currentTime],
  );
  const activeAudioClips = useMemo(
    () => collectActiveAudioClips(content, currentTime),
    [content, currentTime],
  );
  const activeImage = content.images[activeImageIndex];

  useEffect(() => {
    if (!isPlaying) return;

    const intervalId = window.setInterval(() => {
      setCurrentTime((time) => {
        const nextTime = Math.min(durationMs, time + 250);
        if (nextTime >= durationMs) {
          window.clearInterval(intervalId);
          setIsPlaying(false);
        }
        return nextTime;
      });
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [durationMs, isPlaying]);

  return (
    <section className="player-runtime">
      <div className="player-viewport direction-panel">
        <div className="player-image-frame">
          <span>{activeImageIndex + 1}</span>
          <strong>{activeImage?.uuid ?? "no-image"}</strong>
          <small>{activeImage?.src ?? ""}</small>
        </div>
      </div>
      <div className="player-console direction-panel">
        <div className="panel-title-row">
          <h2>{episodeId}</h2>
          <span>{content.format_version}</span>
        </div>
        <input
          max={durationMs}
          min={0}
          onChange={(event) => setCurrentTime(Number(event.target.value))}
          type="range"
          value={currentTime}
        />
        <p>{currentTime}ms / {durationMs}ms</p>
        <div className="button-row">
          <button onClick={() => setIsPlaying((value) => !value)} type="button">
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => setCurrentTime((time) => Math.min(durationMs, time + 1000))}
            type="button"
          >
            +1s
          </button>
        </div>
        <div className="runtime-list">
          <h3>Voice</h3>
          <ol>
            {activeHoles.map((hole) => (
              <li key={hole.uuid}>
                {hole.script} · {hole.records[0]?.src ?? ""}
              </li>
            ))}
          </ol>
        </div>
        <div className="runtime-list">
          <h3>Audio</h3>
          <ol>
            {activeAudioClips.map((clip, index) => (
              <li key={`${clip.src ?? "clip"}-${index}`}>
                {clip.src ?? clip.url ?? clip.rawSrc}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
