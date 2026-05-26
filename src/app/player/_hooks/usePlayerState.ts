/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef } from "react";
import { ToonBoxRef } from "@/app/player/_components/toon/ToonBox";

/**
 * 플레이어 상태 관리 Hook
 *
 * PlayerContent의 모든 state와 ref를 중앙 관리
 */
export function usePlayerState() {
  // ========== States ==========
  // 정주행 모드
  const [isAutoPlay, setIsAutoPlay] = useState(false);

  // 재생 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPendingPlay, setIsPendingPlay] = useState(false);
  const [showLoadingAlert, setShowLoadingAlert] = useState(false);

  // 이미지 로딩 상태
  const [loadedImagesCount, setLoadedImagesCount] = useState(0);
  const [loadedClearTextImagesCount, setLoadedClearTextImagesCount] = useState(0);

  // 컨텐츠 표시 상태 (깜빡임 방지)
  const [showContent, setShowContent] = useState(false);

  // 프리로드 상태 (이미지/오디오 다운로드 진행률) - percentage 기반
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState({
    step: '',
    percentage: 0,
  });

  // ========== Refs ==========
  // ToonBox refs
  const toonBoxRef = useRef<ToonBoxRef>(null);
  const clearTextToonBoxRef = useRef<ToonBoxRef>(null);
  const baseToonWorkRef = useRef<any>(null);
  const clearTextBaseToonWorkRef = useRef<any>(null);

  // 스크롤 관련
  const scrollPositionRef = useRef<number>(0);
  const isScrollSyncEnabled = useRef<boolean>(true);

  // Overlay ref
  const overlayRef = useRef<HTMLDivElement>(null);

  // 이미지 카운트
  const totalImagesRef = useRef(0);
  const totalClearTextImagesRef = useRef(0);

  // 타임아웃 refs
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showContentTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 플래그 refs
  const autoPlayAttemptedRef = useRef(false);
  const toonWorkCleanupRef = useRef<any>(null);

  // 데이터 로드 관련
  const prevSeriesIdRef = useRef<number | null>(null);
  const prevEpisodeIdRef = useRef<number | null>(null);
  const dataLoadRequestedRef = useRef<boolean>(false);

  return {
    // States
    isAutoPlay,
    setIsAutoPlay,
    isPlaying,
    setIsPlaying,
    isPaused,
    setIsPaused,
    isPendingPlay,
    setIsPendingPlay,
    showLoadingAlert,
    setShowLoadingAlert,
    loadedImagesCount,
    setLoadedImagesCount,
    loadedClearTextImagesCount,
    setLoadedClearTextImagesCount,
    showContent,
    setShowContent,
    isPreloading,
    setIsPreloading,
    preloadProgress,
    setPreloadProgress,

    // Refs
    toonBoxRef,
    clearTextToonBoxRef,
    baseToonWorkRef,
    clearTextBaseToonWorkRef,
    scrollPositionRef,
    isScrollSyncEnabled,
    overlayRef,
    totalImagesRef,
    totalClearTextImagesRef,
    loadingTimeoutRef,
    pendingPlayTimeoutRef,
    showContentTimeoutRef,
    autoPlayAttemptedRef,
    toonWorkCleanupRef,
    prevSeriesIdRef,
    prevEpisodeIdRef,
    dataLoadRequestedRef,
  };
}
