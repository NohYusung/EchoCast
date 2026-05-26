import { useCallback, useEffect } from "react";
import { ToonBoxRef } from "@/app/player/_components/toon/ToonBox";
import { playerLogger } from "@/app/player/_lib/playerLogger";

interface UseScrollSyncParams {
  toonBoxRef: React.RefObject<ToonBoxRef | null>;
  clearTextToonBoxRef: React.RefObject<ToonBoxRef | null>;
  scrollPositionRef: React.MutableRefObject<number>;
  isScrollSyncEnabledRef: React.MutableRefObject<boolean>;
  isClearText: boolean;
  playerStoreLoading: boolean;
}

/**
 * 스크롤 동기화 Hook
 *
 * 일반 이미지 레이어와 ClearText 이미지 레이어 간의 스크롤 위치 동기화를 담당
 */
export function useScrollSync(params: UseScrollSyncParams) {
  const {
    toonBoxRef,
    clearTextToonBoxRef,
    scrollPositionRef,
    isScrollSyncEnabledRef,
    isClearText,
    playerStoreLoading,
  } = params;

  // 일반 이미지 레이어 스크롤 핸들러
  const handleNormalScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!isScrollSyncEnabledRef.current) return;

      const scrollTop = e.currentTarget.scrollTop;

      // 현재 스크롤 위치 저장
      scrollPositionRef.current = scrollTop;

      // 동기화 일시 중지
      isScrollSyncEnabledRef.current = false;

      // ClearText 레이어의 스크롤 위치 동기화
      const clearTextToonBoxElement = clearTextToonBoxRef.current?.getScrollableElement();
      if (clearTextToonBoxElement) {
        clearTextToonBoxElement.scrollTop = scrollTop;
      }

      // 동기화 재개 (다음 프레임에서)
      requestAnimationFrame(() => {
        isScrollSyncEnabledRef.current = true;
      });
    },
    [scrollPositionRef, isScrollSyncEnabledRef, clearTextToonBoxRef]
  );

  // ClearText 이미지 레이어 스크롤 핸들러
  const handleClearTextScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!isScrollSyncEnabledRef.current) return;

      const scrollTop = e.currentTarget.scrollTop;

      // 현재 스크롤 위치 저장
      scrollPositionRef.current = scrollTop;

      // 동기화 일시 중지
      isScrollSyncEnabledRef.current = false;

      // 일반 레이어의 스크롤 위치 동기화
      const toonBoxElement = toonBoxRef.current?.getScrollableElement();
      if (toonBoxElement) {
        toonBoxElement.scrollTop = scrollTop;
      }

      // 동기화 재개 (다음 프레임에서)
      requestAnimationFrame(() => {
        isScrollSyncEnabledRef.current = true;
      });
    },
    [scrollPositionRef, isScrollSyncEnabledRef, toonBoxRef]
  );

  // 초기 로드 시 두 레이어 스크롤 위치 동기화
  useEffect(() => {
    if (!playerStoreLoading && toonBoxRef.current && clearTextToonBoxRef.current) {
      const timer = setTimeout(() => {
        const normalElement = toonBoxRef.current?.getScrollableElement();
        const clearTextElement = clearTextToonBoxRef.current?.getScrollableElement();

        if (normalElement && clearTextElement) {
          // 두 레이어 모두 0으로 초기화
          normalElement.scrollTop = 0;
          clearTextElement.scrollTop = 0;
          scrollPositionRef.current = 0;

          playerLogger.log(
            "[PlayerContent] 초기 로드 - 두 레이어 스크롤 위치 동기화 완료"
          );
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [playerStoreLoading, toonBoxRef, clearTextToonBoxRef, scrollPositionRef]);

  // isClearText 상태 변경 시 스크롤 위치 복원
  useEffect(() => {
    if (!toonBoxRef.current || !clearTextToonBoxRef.current) return;

    const savedScrollPosition = scrollPositionRef.current;

    // 전환 애니메이션 시작 전에 즉시 위치 동기화
    const activeElement = isClearText
      ? clearTextToonBoxRef.current?.getScrollableElement()
      : toonBoxRef.current?.getScrollableElement();

    const inactiveElement = isClearText
      ? toonBoxRef.current?.getScrollableElement()
      : clearTextToonBoxRef.current?.getScrollableElement();

    if (activeElement && inactiveElement) {
      // 비활성 레이어에서 현재 스크롤 위치 가져오기
      const currentScroll = inactiveElement.scrollTop;

      // 저장된 위치 또는 현재 위치 중 더 최신 값 사용
      const targetScroll = Math.max(savedScrollPosition, currentScroll);

      // 동기화 일시 중지
      isScrollSyncEnabledRef.current = false;

      // 애니메이션 시작 전에 두 레이어 모두 동일한 위치로 설정
      activeElement.scrollTop = targetScroll;
      inactiveElement.scrollTop = targetScroll;
      scrollPositionRef.current = targetScroll;

      // 동기화 재개 (애니메이션과 동시에)
      requestAnimationFrame(() => {
        isScrollSyncEnabledRef.current = true;
      });
    }
  }, [isClearText, toonBoxRef, clearTextToonBoxRef, scrollPositionRef, isScrollSyncEnabledRef]);

  return {
    handleNormalScroll,
    handleClearTextScroll,
  };
}
