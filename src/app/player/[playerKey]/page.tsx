"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { useAudioPlayerStore } from "@/stores/useAudioPlayerStore";
import PlayerContent, { PlayerContentRef } from "@/app/player/PlayerContent";
import { playerLogger } from "@/app/player/_lib/playerLogger";
import { PLAYER_HEADER_META } from "@/app/player/playerHeaderMeta";
import { WORKS_ENTRY_PLAYER_KEY } from "@/lib/playerContentNormalize";
import { useServiceMode } from "@/contexts/ServiceModeContext";

function decodeTitleQuery(value: string | null): string | undefined {
  if (value == null || !value.trim()) return undefined;
  try {
    const s = decodeURIComponent(value.replace(/\+/g, " "));
    return s.trim() || undefined;
  } catch {
    return value.trim() || undefined;
  }
}

export default function PlayerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const playerKey = typeof params.playerKey === "string" ? params.playerKey : null;
  const rawSeriesId = searchParams.get("seriesId");
  const rawEpisodeId = searchParams.get("episodeId");
  const headerTitleParam = searchParams.get("headerTitle")?.trim();
  const headerSubtitleParam = searchParams.get("headerSubtitle")?.trim();
  const showExperienceEntryParam = searchParams.get("showExperienceEntry");
  const isLoanParam = searchParams.get("isLoan");
  const userHasLoan = isLoanParam === "1" ? true : isLoanParam === "0" ? false : null;
  const seriesId = rawSeriesId != null ? Number(rawSeriesId) : null;
  const episodeId = rawEpisodeId != null ? Number(rawEpisodeId) : null;
  const backendOptions = useMemo(
    () =>
      seriesId != null &&
      episodeId != null &&
      Number.isFinite(seriesId) &&
      Number.isFinite(episodeId)
        ? { seriesId, episodeId }
        : undefined,
    [seriesId, episodeId]
  );
  const resolvedSeriesId = backendOptions?.seriesId ?? 0;

  const playerSeriesEpisodeNav = usePlayerStore((s) => s.playerSeriesEpisodeNav);
  const worksDetailSeriesId = useMemo(() => {
    const fromQuery =
      rawSeriesId != null &&
      Number.isFinite(Number(rawSeriesId)) &&
      Number(rawSeriesId) > 0
        ? Number(rawSeriesId)
        : 0;
    if (fromQuery > 0) return fromQuery;
    if (resolvedSeriesId > 0) return resolvedSeriesId;
    const navSid = playerSeriesEpisodeNav?.seriesId;
    if (navSid != null && Number.isFinite(navSid) && navSid > 0) return navSid;
    return 0;
  }, [rawSeriesId, resolvedSeriesId, playerSeriesEpisodeNav?.seriesId]);
  const seriesTitleQ = searchParams.get("seriesTitle");
  const episodeTitleQ = searchParams.get("episodeTitle");
  const headerMeta = useMemo(() => {
    const base = PLAYER_HEADER_META[playerKey ?? ""] ?? {
      title: "플레이어",
      subtitle: "체험하기",
    };
    const st = decodeTitleQuery(seriesTitleQ);
    const et = decodeTitleQuery(episodeTitleQ);
    if (st || et) {
      return {
        title: st ?? base.title,
        subtitle: et ?? base.subtitle,
        episodeId: base.episodeId,
      };
    }
    return base;
  }, [playerKey, seriesTitleQ, episodeTitleQ]);
  const resolvedEpisodeId = backendOptions?.episodeId ?? headerMeta.episodeId ?? 0;
  const resolvedTitle = headerTitleParam || headerMeta.title;
  const resolvedSubtitle = headerSubtitleParam || headerMeta.subtitle;

  const playerContentRef = useRef<PlayerContentRef>(null);
  const serviceMode = useServiceMode();
  const content = usePlayerStore((s) => s.content);
  const loading = usePlayerStore((s) => s.loading);
  const loadLibContentByPlayerKey = usePlayerStore((s) => s.loadLibContentByPlayerKey);
  const resetPlayerData = usePlayerStore((s) => s.resetPlayerData);
  const pauseMusicPlayer = useAudioPlayerStore((s) => s.pause);
  const shouldWaitForServiceMode =
    serviceMode.isApiEnabled && !serviceMode.isReady && !serviceMode.error;

  const loadOptions = useMemo(
    () => ({
      ...backendOptions,
      serviceType:
        serviceMode.isReady && !serviceMode.error ? (serviceMode.serviceType ?? undefined) : undefined,
    }),
    [backendOptions, serviceMode.error, serviceMode.isReady, serviceMode.serviceType],
  );

  useEffect(() => {
    pauseMusicPlayer();
  }, [pauseMusicPlayer]);

  const stopPlayback = useCallback(async () => {
    try {
      await playerContentRef.current?.handleStop();
    } catch (error) {
      playerLogger.warn("[PlayerPage] failed to stop playback during navigation", error);
    }
  }, []);

  const handleBackNavigation = useCallback(() => {
    void stopPlayback().finally(() => {
      if (worksDetailSeriesId > 0) {
        router.push(`/works/${worksDetailSeriesId}`);
        return;
      }

      router.back();
    });
  }, [router, stopPlayback, worksDetailSeriesId]);

  useEffect(() => {
    if (!playerKey) return;
    if (shouldWaitForServiceMode) {
      playerLogger.log("[PlayerPage] service mode 확정 전이라 player/info 호출 보류");
      return;
    }
    resetPlayerData();
    loadLibContentByPlayerKey(playerKey, loadOptions).then((ok) => {
      if (!ok) {
        playerLogger.warn("[PlayerPage] loadLibContentByPlayerKey failed, redirecting");
        router.replace("/total-list");
      }
    });
  }, [
    playerKey,
    shouldWaitForServiceMode,
    loadLibContentByPlayerKey,
    resetPlayerData,
    router,
    loadOptions,
  ]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void stopPlayback();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      void stopPlayback();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [stopPlayback]);

  if (!playerKey) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-600">잘못된 접근입니다.</p>
      </div>
    );
  }

  if (loading || !content) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-600">콘텐츠 로딩 중...</p>
      </div>
    );
  }

  const version = (() => {
    const format = (content.format_version ?? "").toUpperCase();
    if (format.includes("V0")) return "V0";
    if (format.includes("V1")) return "V1";

    const maybeContent = content as unknown as { spoints?: unknown };
    const spointsUnknown = Array.isArray(maybeContent.spoints) ? maybeContent.spoints : [];
    const spoints = spointsUnknown.filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null);
    const hasPositionRatio = spoints.some((s) => s.positionRatio != null);
    const hasTop = spoints.some((s) => s.top != null);
    if (hasPositionRatio && !hasTop) return "V0";
    return "V1";
  })();

  const showExperienceEntry =
    showExperienceEntryParam === "1" ||
    resolvedSubtitle.includes("체험하기") ||
    playerKey === WORKS_ENTRY_PLAYER_KEY;

  return (
    <PlayerContent
      ref={playerContentRef}
      seriesId={resolvedSeriesId}
      episodeId={resolvedEpisodeId}
      version={version}
      currentPlayerKey={playerKey}
      backHref={handleBackNavigation}
      title={resolvedTitle}
      subtitle={resolvedSubtitle}
      showExperienceEntry={showExperienceEntry}
      userHasLoan={userHasLoan}
    />
  );
}
