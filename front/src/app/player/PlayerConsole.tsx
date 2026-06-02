"use client";

import { ImageIcon, Pause, Play, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPlayerManifest } from "@/api/player";
import { sampleManifest } from "@/data/sampleManifest";
import {
  formatDuration,
  getActiveSceneAtMs,
  getSceneProgress,
} from "@/lib/playerTimeline";
import type { PlaybackManifest } from "@/models/playback";
import styles from "./PlayerConsole.module.css";

type ManifestSource = "api" | "fixture";
type ManifestLoadState = "loading" | "ready" | "fallback";

export function PlayerConsole() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [manifest, setManifest] = useState<PlaybackManifest>(sampleManifest);
  const [manifestSource, setManifestSource] =
    useState<ManifestSource>("fixture");
  const [manifestLoadState, setManifestLoadState] =
    useState<ManifestLoadState>("loading");
  const [positionMs, setPositionMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeScene = useMemo(
    () => getActiveSceneAtMs(manifest, positionMs),
    [manifest, positionMs],
  );
  const activeCue = useMemo(
    () =>
      activeScene?.cues.find(
        (cue) => cue.startMs <= positionMs && positionMs < cue.endMs,
      ) ?? null,
    [activeScene, positionMs],
  );
  const progress = activeScene ? getSceneProgress(activeScene, positionMs) : 0;
  const statusDotClassName = `${styles.statusDot} ${
    manifestLoadState === "fallback" ? styles.statusDotFallback : ""
  }`;

  useEffect(() => {
    let isMounted = true;

    getPlayerManifest(sampleManifest.id)
      .then((remoteManifest) => {
        if (!isMounted) {
          return;
        }
        setManifest(remoteManifest);
        setManifestSource("api");
        setManifestLoadState("ready");
        setPositionMs(0);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setManifest(sampleManifest);
        setManifestSource("fixture");
        setManifestLoadState("fallback");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setPositionMs((current) => (current > manifest.durationMs ? 0 : current));
  }, [manifest.durationMs]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setPositionMs((current) => {
        const next = current + 250;
        return next >= manifest.durationMs ? 0 : next;
      });
    }, 250);

    return () => window.clearInterval(timer);
  }, [isPlaying, manifest.durationMs]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (isPlaying && activeScene?.media.kind === "video") {
      void video.play().catch(() => undefined);
      return;
    }

    video.pause();
  }, [activeScene?.id, activeScene?.media.kind, isPlaying]);

  if (!activeScene) {
    return null;
  }

  const mediaIcon =
    activeScene.media.kind === "video" ? (
      <Video aria-hidden size={18} />
    ) : (
      <ImageIcon aria-hidden size={18} />
    );

  return (
    <main className={styles.surface}>
      <div className={styles.layout}>
        <section className={styles.stageColumn}>
          <div className={styles.toolbar}>
            <div className={styles.titleBlock}>
              <p className={styles.eyebrow}>test-player</p>
              <h1 className={styles.title}>{manifest.title}</h1>
            </div>
            <div className={styles.controls}>
              <button
                aria-label={isPlaying ? "Pause" : "Play"}
                className={styles.iconButton}
                type="button"
                onClick={() => setIsPlaying((current) => !current)}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <span className={styles.timePill}>
                {formatDuration(positionMs)} /{" "}
                {formatDuration(manifest.durationMs)}
              </span>
            </div>
          </div>

          <div className={styles.viewer}>
            {activeScene.media.kind === "video" ? (
              <video
                key={activeScene.id}
                ref={videoRef}
                className={styles.media}
                muted
                loop
                playsInline
                poster={activeScene.media.poster}
                src={activeScene.media.src}
              />
            ) : (
              <img
                alt={activeScene.id}
                className={styles.media}
                src={activeScene.media.src}
              />
            )}
            <div className={styles.mediaMeta}>
              {mediaIcon}
              <span>
                {activeCue?.label ?? activeScene.id} ·{" "}
                {(progress * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className={styles.timeline}>
            {manifest.scenes.map((scene) => {
              const isActive = scene.id === activeScene.id;
              const Icon = scene.media.kind === "video" ? Video : ImageIcon;

              return (
                <button
                  className={`${styles.sceneButton} ${
                    isActive ? styles.sceneButtonActive : ""
                  }`}
                  key={scene.id}
                  type="button"
                  onClick={() => setPositionMs(scene.startMs)}
                >
                  <span className={styles.sceneButtonContent}>
                    <Icon aria-hidden size={18} />
                    <span>
                      <span className={styles.sceneLabel}>{scene.id}</span>
                      <span className={styles.sceneTime}>
                        {formatDuration(scene.startMs)} -{" "}
                        {formatDuration(scene.endMs)}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className={styles.inspector}>
          <div className={styles.inspectorHeader}>
            <h2 className={styles.inspectorTitle}>Manifest</h2>
            <span className={statusDotClassName} />
          </div>
          <div className={styles.manifestList}>
            <div className={styles.manifestRow}>
              <span className={styles.manifestKey}>id</span>
              <span className={styles.manifestValue}>{manifest.id}</span>
            </div>
            <div className={styles.manifestRow}>
              <span className={styles.manifestKey}>variant</span>
              <span className={styles.manifestValue}>{manifest.variant}</span>
            </div>
            <div className={styles.manifestRow}>
              <span className={styles.manifestKey}>source</span>
              <span className={styles.manifestValue}>{manifestSource}</span>
            </div>
            <div className={styles.manifestRow}>
              <span className={styles.manifestKey}>state</span>
              <span className={styles.manifestValue}>{manifestLoadState}</span>
            </div>
            <div className={styles.manifestRow}>
              <span className={styles.manifestKey}>scene</span>
              <span className={styles.manifestValue}>{activeScene.id}</span>
            </div>
            <div className={styles.manifestRow}>
              <span className={styles.manifestKey}>cue</span>
              <span className={styles.manifestValue}>
                {activeCue?.id ?? "-"}
              </span>
            </div>
            <div className={styles.manifestRow}>
              <span className={styles.manifestKey}>media</span>
              <span className={styles.manifestValue}>{activeScene.media.kind}</span>
            </div>
          </div>
          <div className={styles.cueList}>
            {activeScene.cues.map((cue) => (
              <div
                className={`${styles.cueItem} ${
                  activeCue?.id === cue.id ? styles.cueItemActive : ""
                }`}
                key={cue.id}
              >
                <span className={styles.cueLabel}>{cue.label}</span>
                <span className={styles.cueMeta}>
                  {formatDuration(cue.startMs)} - {formatDuration(cue.endMs)} ·
                  scale {cue.viewport.scale}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
