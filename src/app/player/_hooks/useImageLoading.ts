/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect } from "react";
import { getLibMediaUrl, getMediaUrl, isLibMediaPath } from "@/lib/environment";
import { playerLogger } from "@/app/player/_lib/playerLogger";

interface UseImageLoadingParams {
  version: "V0" | "V1";
  totalImagesRef: React.MutableRefObject<number>;
  totalClearTextImagesRef: React.MutableRefObject<number>;
  baseToonWorkRef: React.MutableRefObject<any>;
  clearTextBaseToonWorkRef: React.MutableRefObject<any>;
  loadedImagesCount: number;
  setLoadedImagesCount: React.Dispatch<React.SetStateAction<number>>;
  loadedClearTextImagesCount: number;
  setLoadedClearTextImagesCount: React.Dispatch<React.SetStateAction<number>>;
  toonWorkHandleResize: () => void;
}

/**
 * 이미지 로딩 관리 Hook
 *
 * 이미지 URL 추출, 키 생성, 로딩 완료 핸들링을 담당
 */
export function useImageLoading(params: UseImageLoadingParams) {
  const {
    version,
    totalImagesRef,
    totalClearTextImagesRef,
    baseToonWorkRef,
    clearTextBaseToonWorkRef,
    loadedImagesCount,
    setLoadedImagesCount,
    loadedClearTextImagesCount,
    setLoadedClearTextImagesCount,
    toonWorkHandleResize,
  } = params;

  // 이미지 URL 추출 함수. lib(webtoon/...) 경로는 전용 media base를 사용한다.
  const getImageUrl = useCallback((image: any) => {
    const path = image.url || image.rawSrc || image.src;
    if (typeof path !== "string") {
      return "";
    }
    return isLibMediaPath(path) ? getLibMediaUrl(path) : getMediaUrl(path, "image");
  }, []);

  // 이미지 key 생성 함수
  const getImageKey = useCallback(
    (image: any, index: number) => {
      if (version === "V0") {
        return `${image.uuid || image.id || index}`;
      }
      return `${image.url}-${index}`;
    },
    [version]
  );

  // 이미지 렌더링 완료 핸들러
  const handleImageLoad = useCallback(
    () => {
      setLoadedImagesCount((prev) => prev + 1);
    },
    [setLoadedImagesCount]
  );

  // ClearText 이미지 렌더링 완료 핸들러
  const handleClearTextImageLoad = useCallback(
    () => {
      setLoadedClearTextImagesCount((prev) => prev + 1);
    },
    [setLoadedClearTextImagesCount]
  );

  // 이미 로드된 이미지 체크 (onLoad 이벤트가 발생하지 않을 수 있음)
  useEffect(() => {
    if (totalImagesRef.current === 0) return;

    const checkLoadedImages = () => {
      const normalImages =
        baseToonWorkRef.current && "querySelectorAll" in baseToonWorkRef.current
          ? baseToonWorkRef.current.querySelectorAll("img")
          : [];
      const clearImages =
        clearTextBaseToonWorkRef.current && "querySelectorAll" in clearTextBaseToonWorkRef.current
          ? clearTextBaseToonWorkRef.current.querySelectorAll("img")
          : [];

      let normalLoadedCount = 0;
      let clearLoadedCount = 0;

      normalImages.forEach((img: HTMLImageElement) => {
        if (img.complete && img.naturalHeight !== 0) {
          normalLoadedCount++;
        }
      });

      clearImages.forEach((img: HTMLImageElement) => {
        if (img.complete && img.naturalHeight !== 0) {
          clearLoadedCount++;
        }
      });

      playerLogger.log("[useImageLoading] 이미지 로드 체크:", {
        normalImages: `${normalLoadedCount}/${totalImagesRef.current}`,
        clearImages: `${clearLoadedCount}/${totalClearTextImagesRef.current}`,
        currentLoadedCount: loadedImagesCount,
        currentClearLoadedCount: loadedClearTextImagesCount,
      });

      if (normalLoadedCount > loadedImagesCount) {
        playerLogger.log(`[useImageLoading] 일반 이미지 카운트 업데이트: ${loadedImagesCount} → ${normalLoadedCount}`);
        setLoadedImagesCount(normalLoadedCount);
      }

      if (clearLoadedCount > loadedClearTextImagesCount) {
        playerLogger.log(`[useImageLoading] ClearText 이미지 카운트 업데이트: ${loadedClearTextImagesCount} → ${clearLoadedCount}`);
        setLoadedClearTextImagesCount(clearLoadedCount);
      }

      // 이미지가 모두 로드되었으면 화면 크기 재계산 (reload 시 정확한 계산을 위해)
      const allNormalImagesLoaded = normalLoadedCount >= totalImagesRef.current;
      const allClearImagesLoaded =
        totalClearTextImagesRef.current === 0 ||
        clearLoadedCount >= totalClearTextImagesRef.current;

      if (allNormalImagesLoaded && allClearImagesLoaded) {
        playerLogger.log("[useImageLoading] 모든 이미지 로드 완료 - 화면 크기 재계산");
        toonWorkHandleResize();
      }
    };

    // 약간의 지연 후 체크 (DOM이 완전히 렌더링된 후)
    const timer = setTimeout(checkLoadedImages, 500);

    return () => clearTimeout(timer);
  }, [
    totalImagesRef,
    totalClearTextImagesRef,
    baseToonWorkRef,
    clearTextBaseToonWorkRef,
    loadedImagesCount,
    setLoadedImagesCount,
    loadedClearTextImagesCount,
    setLoadedClearTextImagesCount,
    toonWorkHandleResize,
  ]);

  return {
    getImageUrl,
    getImageKey,
    handleImageLoad,
    handleClearTextImageLoad,
  };
}
