import type {
  VogopangContentImage,
  VogopangContentSpoint,
} from "@/data/vogopangContentTypes";
import { getFetchUrl } from "@/lib/environment";
import { getImageMemoryCache, getImageMemoryCacheSize } from "@/stores/usePlayerStore";
import { ImageHelper, MarkerHelper } from "@/app/player/_lib/toonWorkCommon";

type RecordingPreviewContentVersion = "V0" | "V1" | "V2" | "V3";

export type RecordingPreviewMarker = {
  positionRatio?: number;
  top?: number;
  time_ms?: number;
  startMs?: number;
  index?: number;
};

type RenderedImageMetric = {
  image: HTMLImageElement;
  index: number;
  sortedImageIndex: number;
  top: number;
  bottom: number;
  center: number;
  height: number;
  fileSize: number | null;
  preferredOffset: number;
  rangeDistance: number;
  viewportDistance: number;
};

export type RecordingPreviewResolution = {
  image: VogopangContentImage;
  index: number;
  thumbnailSrc: string | null;
  scrollTop: number | null;
  source: "direct" | "rendered" | "data";
};

export type RecordingPreviewDirectImageRef = {
  imageUuids?: readonly string[] | null;
  imageSrcs?: readonly string[] | null;
};

function getPlayerImageCachePath(image?: Partial<VogopangContentImage> | null): string {
  const img = image as
    | (Partial<VogopangContentImage> & { url?: string; rawSrc?: string })
    | null
    | undefined;
  return String(img?.url || img?.rawSrc || img?.src || "").trim();
}

function getResolvedImageUrl(image?: VogopangContentImage | null): string | null {
  if (!image) {
    return null;
  }

  const path = getPlayerImageCachePath(image);
  const cachedImageUrl = path ? getImageMemoryCache().get(path) : undefined;
  const resolvedUrl = ImageHelper.getImageUrl(image);
  return cachedImageUrl || (resolvedUrl ? getFetchUrl(resolvedUrl) : null);
}

function normalizeImageUuid(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase().replace(/-/g, "");
}

function normalizeImageSrc(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const withoutHash = value.split("#")[0] ?? value;
  const withoutQuery = withoutHash.split("?")[0] ?? withoutHash;
  try {
    const url = new URL(withoutQuery);
    return url.pathname.replace(/^\/+/, "").toLowerCase();
  } catch {
    return withoutQuery.replace(/^\/+/, "").toLowerCase();
  }
}

function imageMatchesDirectSrc(image: VogopangContentImage, directSrcs: Set<string>): boolean {
  if (directSrcs.size === 0) return false;
  const candidates = [
    image.src,
    (image as VogopangContentImage & { url?: string; rawSrc?: string }).url,
    (image as VogopangContentImage & { url?: string; rawSrc?: string }).rawSrc,
    image.realname,
    getResolvedImageUrl(image),
  ]
    .map(normalizeImageSrc)
    .filter(Boolean);

  return candidates.some((candidate) => {
    for (const src of directSrcs) {
      if (candidate === src || candidate.endsWith(src) || src.endsWith(candidate)) {
        return true;
      }
    }
    return false;
  });
}

function resolveDirectImageSrcForBrowser(src: string | undefined): string | null {
  const trimmed = src?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return getFetchUrl(trimmed);
  }
  return null;
}

function resolveDirectRecordingPreview(params: {
  images: VogopangContentImage[];
  directImage?: RecordingPreviewDirectImageRef | null;
}): RecordingPreviewResolution | null {
  const sortedImages = [...params.images].sort((a, b) => a.order - b.order);
  if (sortedImages.length === 0 || !params.directImage) {
    return null;
  }

  const directUuids = new Set(
    (params.directImage.imageUuids ?? [])
      .map(normalizeImageUuid)
      .filter(Boolean),
  );
  const directSrcs = new Set(
    (params.directImage.imageSrcs ?? [])
      .map(normalizeImageSrc)
      .filter(Boolean),
  );

  if (directUuids.size === 0 && directSrcs.size === 0) {
    return null;
  }

  const index = sortedImages.findIndex((image) => {
    const imageUuid = normalizeImageUuid(image.uuid);
    return (
      (imageUuid && directUuids.has(imageUuid)) ||
      imageMatchesDirectSrc(image, directSrcs)
    );
  });
  if (index < 0) {
    return null;
  }

  const image = sortedImages[index];
  const directSrc = [...(params.directImage.imageSrcs ?? [])].find((src) => normalizeImageSrc(src));

  return {
    image,
    index,
    thumbnailSrc: resolveDirectImageSrcForBrowser(directSrc) ?? getResolvedImageUrl(image),
    scrollTop: null,
    source: "direct",
  };
}

function normalizePreviewMarkers(
  markers: RecordingPreviewMarker[],
): ReturnType<typeof MarkerHelper.normalizeMarker>[] {
  return MarkerHelper.sortByIndex(
    markers.map((marker, index) =>
      MarkerHelper.normalizeMarker({
        ...marker,
        index: marker.index ?? index,
      }),
    ),
  );
}

export function resolveRecordingPreviewImageIndex(
  holeStartMs: number,
  markers: RecordingPreviewMarker[],
  imageCount: number,
  version: RecordingPreviewContentVersion,
): number {
  if (imageCount === 0 || markers.length === 0) {
    return 0;
  }

  const sorted = [...markers].sort(
    (a, b) => (a.time_ms ?? a.startMs ?? 0) - (b.time_ms ?? b.startMs ?? 0),
  );

  let beforeIdx = -1;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if ((sorted[i].time_ms ?? sorted[i].startMs ?? 0) <= holeStartMs) {
      beforeIdx = i;
      break;
    }
  }

  const afterIdx = beforeIdx + 1 < sorted.length ? beforeIdx + 1 : -1;

  let ratio = 0;
  if (beforeIdx >= 0 && afterIdx >= 0) {
    const startTime = sorted[beforeIdx].time_ms ?? sorted[beforeIdx].startMs ?? 0;
    const endTime = sorted[afterIdx].time_ms ?? sorted[afterIdx].startMs ?? 0;
    ratio = endTime > startTime ? (holeStartMs - startTime) / (endTime - startTime) : 0;
  }

  const scrollRatio =
    version === "V0"
      ? (() => {
          const startRatio = beforeIdx >= 0 ? (sorted[beforeIdx].positionRatio ?? 0) : 0;
          const endRatio = afterIdx >= 0 ? (sorted[afterIdx].positionRatio ?? 100) : 100;
          const interpolated =
            beforeIdx < 0
              ? endRatio
              : afterIdx < 0
                ? startRatio
                : startRatio + ratio * (endRatio - startRatio);
          return interpolated / 100;
        })()
      : (() => {
          const maxTop = Math.max(1, ...sorted.map((marker) => marker.top ?? 0));
          const startTop = beforeIdx >= 0 ? (sorted[beforeIdx].top ?? 0) : 0;
          const endTop = afterIdx >= 0 ? (sorted[afterIdx].top ?? maxTop) : maxTop;
          const interpolated =
            beforeIdx < 0
              ? endTop
              : afterIdx < 0
                ? startTop
                : startTop + ratio * (endTop - startTop);
          return interpolated / maxTop;
        })();

  return Math.min(Math.max(0, Math.floor(scrollRatio * imageCount)), imageCount - 1);
}

export function resolveRecordingPreviewImage(
  holeStartMs: number,
  content: {
    images: VogopangContentImage[];
    sceneMarkers?: RecordingPreviewMarker[];
    spoints?: Array<Partial<VogopangContentSpoint> & { time_ms?: number }>;
  },
  version: RecordingPreviewContentVersion = "V1",
): { image: VogopangContentImage; index: number } | null {
  const sortedImages = [...content.images].sort((a, b) => a.order - b.order);
  if (sortedImages.length === 0) {
    return null;
  }

  const markers = normalizePreviewMarkers(content.sceneMarkers ?? content.spoints ?? []);
  const imageIndex = resolveRecordingPreviewImageIndex(
    holeStartMs,
    markers,
    sortedImages.length,
    version,
  );

  return {
    image: sortedImages[imageIndex] ?? sortedImages[0],
    index: imageIndex,
  };
}

export function resolveRecordingPreviewThumbnailUrl(
  holeStartMs: number,
  content: {
    images: VogopangContentImage[];
    sceneMarkers?: RecordingPreviewMarker[];
    spoints?: Array<Partial<VogopangContentSpoint> & { time_ms?: number }>;
  },
  version: RecordingPreviewContentVersion = "V1",
): string | null {
  const previewImage = resolveRecordingPreviewImage(holeStartMs, content, version);
  return getResolvedImageUrl(previewImage?.image);
}

function shouldPreferAdjacentSceneThumbnail(params: {
  requestedMs: number;
  markers: RecordingPreviewMarker[];
  currentSceneHeight: number;
  currentSceneIndex: number;
  adjacentSceneIndex: number;
  direction: "previous" | "next";
}): boolean {
  const {
    requestedMs,
    markers,
    currentSceneHeight,
    currentSceneIndex,
    adjacentSceneIndex,
    direction,
  } = params;

  const isValidAdjacentScene =
    direction === "next"
      ? adjacentSceneIndex > currentSceneIndex
      : adjacentSceneIndex < currentSceneIndex;

  if (!isValidAdjacentScene) {
    return false;
  }

  const markersByTime = new Map<number, ReturnType<typeof MarkerHelper.normalizeMarker>>();
  for (const marker of MarkerHelper.sortByTime(markers.map((item) => MarkerHelper.normalizeMarker(item)))) {
    markersByTime.set(marker.time_ms, marker);
  }

  const sortedMarkers = [...markersByTime.values()].sort((a, b) => a.time_ms - b.time_ms);
  for (let index = 0; index < sortedMarkers.length - 1; index += 1) {
    const currentMarker = sortedMarkers[index];
    const nextMarker = sortedMarkers[index + 1];

    if (!currentMarker || !nextMarker) {
      continue;
    }

    if (requestedMs <= currentMarker.time_ms || requestedMs >= nextMarker.time_ms) {
      continue;
    }

    const intervalDurationMs = nextMarker.time_ms - currentMarker.time_ms;
    if (intervalDurationMs <= 0 || intervalDurationMs > 720) {
      return false;
    }

    const intervalProgress = (requestedMs - currentMarker.time_ms) / intervalDurationMs;
    const elapsedSinceCurrentMarkerMs = requestedMs - currentMarker.time_ms;
    const remainingUntilNextMarkerMs = nextMarker.time_ms - requestedMs;
    const positionRatioDelta = Math.abs(nextMarker.positionRatio - currentMarker.positionRatio);
    const topDelta = Math.abs(nextMarker.top - currentMarker.top);
    const hasMeaningfulSceneJump =
      positionRatioDelta >= 0.57 || topDelta >= Math.max(275, currentSceneHeight * 0.44);
    const progressThreshold = intervalDurationMs <= 450 ? 0.31 : 0.46;
    const previousProgressThreshold = intervalDurationMs <= 450 ? 0.06 : 0.1;
    const previousElapsedThresholdMs = Math.min(60, intervalDurationMs * 0.12);

    if (!hasMeaningfulSceneJump) {
      return false;
    }

    if (direction === "next") {
      return elapsedSinceCurrentMarkerMs >= 118 && intervalProgress >= progressThreshold;
    }

    return (
      remainingUntilNextMarkerMs >= 112 &&
      elapsedSinceCurrentMarkerMs <= previousElapsedThresholdMs &&
      intervalProgress <= previousProgressThreshold
    );
  }

  return false;
}

function resolveFallbackRecordingPreview(params: {
  holeStartMs: number;
  images: VogopangContentImage[];
  markers: RecordingPreviewMarker[];
  sceneMarkers: RecordingPreviewMarker[];
  spoints?: Array<Partial<VogopangContentSpoint> & { time_ms?: number }>;
  version: RecordingPreviewContentVersion;
}): RecordingPreviewResolution | null {
  const sortedImages = [...params.images].sort((a, b) => a.order - b.order);
  if (sortedImages.length === 0) {
    return null;
  }

  const baseMarkers =
    params.markers.length > 0
      ? params.markers
      : normalizePreviewMarkers(
          params.sceneMarkers.length > 0 ? params.sceneMarkers : params.spoints ?? [],
        );
  const index = resolveRecordingPreviewImageIndex(
    params.holeStartMs,
    baseMarkers,
    sortedImages.length,
    params.version,
  );
  const image = sortedImages[index] ?? sortedImages[0];

  return {
    image,
    index,
    thumbnailSrc: getResolvedImageUrl(image),
    scrollTop: null,
    source: "data",
  };
}

export function resolveRecordingPreviewThumbnail(params: {
  holeStartMs: number;
  sceneMarkers?: RecordingPreviewMarker[];
  spoints?: Array<Partial<VogopangContentSpoint> & { time_ms?: number }>;
  images: VogopangContentImage[];
  contentList: HTMLElement | null;
  markers: RecordingPreviewMarker[];
  version: RecordingPreviewContentVersion;
  targetScrollTop: number | null;
  isSnappedBackwardToSceneStart?: boolean;
  directImage?: RecordingPreviewDirectImageRef | null;
}): RecordingPreviewResolution | null {
  const {
    holeStartMs,
    sceneMarkers = [],
    spoints,
    images,
    contentList,
    markers,
    version,
    targetScrollTop,
    isSnappedBackwardToSceneStart = false,
    directImage,
  } = params;
  const sortedImages = [...images].sort((a, b) => a.order - b.order);
  if (sortedImages.length === 0) {
    return null;
  }

  const directFallback = resolveDirectRecordingPreview({
    images: sortedImages,
    directImage,
  });
  const fallback = directFallback ?? resolveFallbackRecordingPreview({
    holeStartMs,
    images: sortedImages,
    markers,
    sceneMarkers,
    spoints,
    version,
  });

  if (!contentList || (targetScrollTop === null && !directFallback)) {
    return fallback;
  }

  const renderedImages = Array.from(
    contentList.querySelectorAll<HTMLImageElement>("img.toon-image"),
  ).filter((image) => {
    const rect = image.getBoundingClientRect();
    const src = image.currentSrc || image.src || "";
    return rect.width > 0 && rect.height > 0 && !src.startsWith("data:");
  });

  if (renderedImages.length === 0) {
    return fallback;
  }

  const imageOrderToSortedIndex = new Map<number, number>();
  sortedImages.forEach((image, index) => {
    if (Number.isFinite(image.order)) {
      imageOrderToSortedIndex.set(image.order, index);
    }
  });

  const contentRect = contentList.getBoundingClientRect();
  const imageMetrics = renderedImages.map((image, index) => {
    const rect = image.getBoundingClientRect();
    const top = rect.top - contentRect.top + contentList.scrollTop;
    const rawImageOrder = Number(image.dataset.imageOrder);
    const mappedSortedImageIndex =
      Number.isFinite(rawImageOrder) && imageOrderToSortedIndex.has(rawImageOrder)
        ? imageOrderToSortedIndex.get(rawImageOrder)
        : undefined;
    const sortedImageIndex = Math.min(
      Math.max(0, mappedSortedImageIndex ?? index),
      sortedImages.length - 1,
    );

    return {
      image,
      index,
      sortedImageIndex,
      top,
      bottom: top + rect.height,
      center: top + rect.height / 2,
      height: rect.height,
    };
  });

  if (directFallback) {
    const matchedMetric = imageMetrics.find(
      (metric) => metric.sortedImageIndex === directFallback.index,
    );
    if (matchedMetric) {
      const renderedSrc = matchedMetric.image.currentSrc || matchedMetric.image.src || "";
      const scrollRange = Math.max(0, contentList.scrollHeight - contentList.clientHeight);
      const scrollTop = Math.min(
        scrollRange,
        Math.max(
          0,
          matchedMetric.top -
            Math.max(0, contentList.clientHeight - matchedMetric.height) / 2,
        ),
      );

      return {
        ...directFallback,
        thumbnailSrc:
          renderedSrc.trim() && !renderedSrc.startsWith("data:")
            ? renderedSrc
            : directFallback.thumbnailSrc,
        scrollTop,
      };
    }

    return directFallback;
  }

  if (targetScrollTop === null) {
    return fallback;
  }

  const sortedHeights = imageMetrics
    .map((metric) => metric.height)
    .filter((height) => Number.isFinite(height) && height > 0)
    .sort((a, b) => a - b);
  const medianHeight =
    sortedHeights.length > 0 ? sortedHeights[Math.floor(sortedHeights.length / 2)] : 0;
  const maxHeight = sortedHeights.length > 0 ? sortedHeights[sortedHeights.length - 1] : 0;

  const isLikelyPanelMetric = (metric?: Pick<RenderedImageMetric, "height">) => {
    if (!metric) {
      return false;
    }

    return (
      metric.height > 0 &&
      ((medianHeight > 0 && metric.height < medianHeight * 0.9) ||
        (maxHeight > 0 && metric.height < maxHeight * 0.82))
    );
  };
  const imageSizeCache = getImageMemoryCacheSize();
  const preferredCandidateOffsets = [0, 1, -1];
  const fallbackIndex = fallback?.index ?? 0;
  const viewportAnchor = targetScrollTop;
  const compareCandidateOffset = (a: number, b: number) => {
    const aPriority = preferredCandidateOffsets.indexOf(a);
    const bPriority = preferredCandidateOffsets.indexOf(b);

    if (aPriority !== -1 || bPriority !== -1) {
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    }

    const absDiff = Math.abs(a) - Math.abs(b);
    if (absDiff !== 0) {
      return absDiff;
    }

    return a - b;
  };

  const candidateMetrics = imageMetrics
    .map<RenderedImageMetric>((metric) => {
      const imageMeta = sortedImages[metric.sortedImageIndex];
      const imagePath = getPlayerImageCachePath(imageMeta);
      const fileSize =
        imagePath && imageSizeCache.has(imagePath)
          ? imageSizeCache.get(imagePath) ?? null
          : null;
      const preferredOffset = metric.sortedImageIndex - fallbackIndex;
      const rangeDistance =
        viewportAnchor < metric.top
          ? metric.top - viewportAnchor
          : viewportAnchor >= metric.bottom
            ? viewportAnchor - metric.bottom
            : 0;
      const viewportDistance = Math.abs(metric.center - viewportAnchor);

      return {
        ...metric,
        fileSize,
        preferredOffset,
        rangeDistance,
        viewportDistance,
      };
    })
    .sort((a, b) => {
      const rangeComparison = a.rangeDistance - b.rangeDistance;
      if (rangeComparison !== 0) {
        return rangeComparison;
      }

      const offsetComparison = compareCandidateOffset(a.preferredOffset, b.preferredOffset);
      if (offsetComparison !== 0) {
        return offsetComparison;
      }

      const viewportComparison = a.viewportDistance - b.viewportDistance;
      if (viewportComparison !== 0) {
        return viewportComparison;
      }

      return a.sortedImageIndex - b.sortedImageIndex;
    });
  const uniqueCandidateMetrics = candidateMetrics.filter((metric, index, array) => {
    return array.findIndex((item) => item.sortedImageIndex === metric.sortedImageIndex) === index;
  });

  const candidateFileSizes = uniqueCandidateMetrics
    .map((metric) => metric.fileSize)
    .filter((size): size is number => size != null && Number.isFinite(size) && size > 0);
  const maxCandidateFileSize = candidateFileSizes.length > 0 ? Math.max(...candidateFileSizes) : 0;
  const hasMeaningfulFileSizeSignals = candidateFileSizes.length > 0 && maxCandidateFileSize > 0;
  const isLikelyPanelByFileSize = (fileSize: number | null) => {
    if (!Number.isFinite(fileSize) || fileSize === null || fileSize <= 0 || maxCandidateFileSize <= 0) {
      return false;
    }

    return fileSize < Math.max(2_048, maxCandidateFileSize * 0.12);
  };
  const sceneOrderedMetrics = [...uniqueCandidateMetrics].sort((a, b) => {
    const indexDiff = a.sortedImageIndex - b.sortedImageIndex;
    if (indexDiff !== 0) {
      return indexDiff;
    }

    return a.top - b.top;
  });
  const exactTargetMetric = sceneOrderedMetrics.find((metric) => metric.rangeDistance === 0);
  const edgeBiasedTargetMetric = (() => {
    if (!exactTargetMetric || exactTargetMetric.height <= 0) {
      return exactTargetMetric;
    }

    const previousMetric = [...sceneOrderedMetrics]
      .reverse()
      .find((metric) => metric.sortedImageIndex < exactTargetMetric.sortedImageIndex);
    const nextMetric = sceneOrderedMetrics.find(
      (metric) => metric.sortedImageIndex > exactTargetMetric.sortedImageIndex,
    );

    if (
      previousMetric &&
      shouldPreferAdjacentSceneThumbnail({
        requestedMs: holeStartMs,
        markers,
        currentSceneHeight: exactTargetMetric.height,
        currentSceneIndex: exactTargetMetric.sortedImageIndex,
        adjacentSceneIndex: previousMetric.sortedImageIndex,
        direction: "previous",
      })
    ) {
      return previousMetric;
    }

    if (
      nextMetric &&
      shouldPreferAdjacentSceneThumbnail({
        requestedMs: holeStartMs,
        markers,
        currentSceneHeight: exactTargetMetric.height,
        currentSceneIndex: exactTargetMetric.sortedImageIndex,
        adjacentSceneIndex: nextMetric.sortedImageIndex,
        direction: "next",
      })
    ) {
      return nextMetric;
    }

    const metricProgress = (viewportAnchor - exactTargetMetric.top) / exactTargetMetric.height;
    const distanceFromTop = viewportAnchor - exactTargetMetric.top;
    const remainingDistance = exactTargetMetric.bottom - viewportAnchor;
    const edgeSceneProgressThreshold = 0.62;
    const edgeSceneDistanceThreshold = Math.min(340, exactTargetMetric.height * 0.4);
    const previousSceneProgressThreshold = 0.08;
    const previousSceneDistanceThreshold = Math.min(90, exactTargetMetric.height * 0.12);

    if (
      !isSnappedBackwardToSceneStart &&
      previousMetric &&
      metricProgress <= previousSceneProgressThreshold &&
      distanceFromTop <= previousSceneDistanceThreshold
    ) {
      return previousMetric;
    }

    if (metricProgress < edgeSceneProgressThreshold && remainingDistance > edgeSceneDistanceThreshold) {
      return exactTargetMetric;
    }

    return nextMetric ?? exactTargetMetric;
  })();

  const matchedMetric =
    edgeBiasedTargetMetric ??
    (hasMeaningfulFileSizeSignals
      ? uniqueCandidateMetrics.find((metric) => !isLikelyPanelByFileSize(metric.fileSize))
      : undefined) ??
    (hasMeaningfulFileSizeSignals
      ? [...uniqueCandidateMetrics]
          .filter((metric) => Number.isFinite(metric.fileSize) && (metric.fileSize ?? 0) > 0)
          .sort((a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0))[0]
      : undefined) ??
    uniqueCandidateMetrics.find((metric) => !isLikelyPanelMetric(metric)) ??
    uniqueCandidateMetrics[0];

  const image = sortedImages[matchedMetric?.sortedImageIndex ?? fallbackIndex] ?? fallback?.image;
  if (!image) {
    return fallback;
  }

  const renderedSrc = matchedMetric?.image.currentSrc || matchedMetric?.image.src || "";
  const scrollRange = Math.max(0, contentList.scrollHeight - contentList.clientHeight);
  const scrollTop = matchedMetric
    ? Math.min(
        scrollRange,
        Math.max(0, matchedMetric.top - Math.max(0, contentList.clientHeight - matchedMetric.height) / 2),
      )
    : null;

  return {
    image,
    index: matchedMetric?.sortedImageIndex ?? fallbackIndex,
    thumbnailSrc:
      renderedSrc.trim() && !renderedSrc.startsWith("data:")
        ? renderedSrc
        : getResolvedImageUrl(image),
    scrollTop,
    source: "rendered",
  };
}
