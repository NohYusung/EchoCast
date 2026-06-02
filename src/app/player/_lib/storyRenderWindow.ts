export {
  buildPlaybackV2StoryRenderSource,
  getPlaybackContentStoryRenderSource,
  type PlaybackV2StoryRenderSource,
} from "@/lib/playbackContentAccess";

export interface StoryRenderBlock<TImage = unknown> {
  key: string;
  image: TImage;
  imageIndex: number;
  topPx: number;
  heightPx: number;
}

export interface StoryRenderWindow<TImage = unknown> {
  totalHeightPx: number;
  blocks: Array<StoryRenderBlock<TImage>>;
}

export interface BuildStoryRenderWindowParams<TImage = unknown> {
  images: TImage[];
  imageHeightPx: number;
  viewportTopPx: number;
  viewportHeightPx: number;
  overscanPx: number;
  getImageKey?: (image: TImage, index: number) => string;
}

export interface StoryRenderItem<TPayload = unknown> {
  key: string;
  payload: TPayload;
  heightPx: number;
}

export interface StoryItemRenderBlock<TPayload = unknown> extends StoryRenderItem<TPayload> {
  itemIndex: number;
  topPx: number;
}

export interface StoryItemRenderWindow<TPayload = unknown> {
  totalHeightPx: number;
  blocks: Array<StoryItemRenderBlock<TPayload>>;
}

export interface BuildStoryItemRenderWindowParams<TPayload = unknown> {
  items: Array<StoryRenderItem<TPayload>>;
  viewportTopPx: number;
  viewportHeightPx: number;
  overscanPx: number;
}

export type VerticalStoryRenderItemPayload<TImage = unknown, TInlineMedia = unknown> =
  | {
      kind: "image-segment";
      image: TImage;
      imageIndex: number;
      fromRatio: number;
      toRatio: number;
      countedImage: boolean;
    }
  | {
      kind: "inline-media";
      media: TInlineMedia;
      mediaIndex: number;
    };

export type VerticalStoryRenderItem<TImage = unknown, TInlineMedia = unknown> = StoryRenderItem<
  VerticalStoryRenderItemPayload<TImage, TInlineMedia>
>;

export interface BuildVerticalStoryRenderItemsParams<TImage = unknown, TInlineMedia = unknown> {
  images: TImage[];
  inlineMedia: TInlineMedia[];
  imageHeightPx: number;
  inlineMediaWidthPx: number;
  getImageKey?: (image: TImage, index: number) => string;
  getImageOrder?: (image: TImage, index: number) => number | undefined;
  getInlineMediaKey?: (media: TInlineMedia, index: number) => string;
  getInlineMediaPlacement?: (
    media: TInlineMedia,
    index: number,
  ) => { imageOrder: number | undefined; offsetRatio: number | undefined } | null;
  getInlineMediaAspectRatio?: (media: TInlineMedia, index: number) => string | undefined;
}


function normalizedPositiveNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clampUnitRatio(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value ?? 1));
}

function aspectRatioHeightPx(aspectRatio: string | undefined, widthPx: number): number {
  const safeWidthPx = normalizedPositiveNumber(widthPx);
  if (safeWidthPx <= 0) return 0;

  const raw = aspectRatio?.trim() || "16 / 9";
  const ratioMatch = raw.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (ratioMatch) {
    const width = Number(ratioMatch[1]);
    const height = Number(ratioMatch[2]);
    if (width > 0 && height > 0) {
      return safeWidthPx * (height / width);
    }
  }

  const numericRatio = Number(raw);
  if (Number.isFinite(numericRatio) && numericRatio > 0) {
    return safeWidthPx / numericRatio;
  }

  return safeWidthPx * (9 / 16);
}

export function buildVerticalStoryRenderItems<TImage, TInlineMedia>(
  params: BuildVerticalStoryRenderItemsParams<TImage, TInlineMedia>,
): Array<VerticalStoryRenderItem<TImage, TInlineMedia>> {
  const imageHeightPx = normalizedPositiveNumber(params.imageHeightPx);
  if (params.images.length === 0 || imageHeightPx <= 0) return [];

  const mediaByImageOrder = new Map<
    number,
    Array<{
      media: TInlineMedia;
      mediaIndex: number;
      key: string;
      offsetRatio: number;
      heightPx: number;
    }>
  >();

  params.inlineMedia.forEach((media, mediaIndex) => {
    const placement = params.getInlineMediaPlacement?.(media, mediaIndex);
    const imageOrder = placement?.imageOrder;
    if (!Number.isFinite(imageOrder)) return;

    const normalizedImageOrder = Number(imageOrder);
    const mediaItems = mediaByImageOrder.get(normalizedImageOrder) ?? [];
    mediaItems.push({
      media,
      mediaIndex,
      key: params.getInlineMediaKey?.(media, mediaIndex) ?? `inline-media-${mediaIndex}`,
      offsetRatio: clampUnitRatio(placement?.offsetRatio),
      heightPx: aspectRatioHeightPx(
        params.getInlineMediaAspectRatio?.(media, mediaIndex),
        params.inlineMediaWidthPx,
      ),
    });
    mediaByImageOrder.set(normalizedImageOrder, mediaItems);
  });

  const items: Array<VerticalStoryRenderItem<TImage, TInlineMedia>> = [];

  params.images.forEach((image, imageIndex) => {
    const imageKey = params.getImageKey?.(image, imageIndex) ?? `image-${imageIndex}`;
    const imageOrder = params.getImageOrder?.(image, imageIndex) ?? imageIndex + 1;
    const mediaItems = [...(mediaByImageOrder.get(imageOrder) ?? [])].sort(
      (a, b) => a.offsetRatio - b.offsetRatio,
    );
    let previousOffsetRatio = 0;
    let countedImage = false;

    const pushImageSegment = (
      fromRatio: number,
      toRatio: number,
      segmentKey: string,
    ) => {
      if (toRatio <= fromRatio) return;
      const isCountedImageSegment = !countedImage;
      countedImage = true;
      items.push({
        key: segmentKey,
        payload: {
          kind: "image-segment",
          image,
          imageIndex,
          fromRatio,
          toRatio,
          countedImage: isCountedImageSegment,
        },
        heightPx: imageHeightPx * (toRatio - fromRatio),
      });
    };

    if (mediaItems.length === 0) {
      pushImageSegment(0, 1, `${imageKey}-full`);
      return;
    }

    mediaItems.forEach((mediaItem, mediaItemIndex) => {
      pushImageSegment(
        previousOffsetRatio,
        mediaItem.offsetRatio,
        `${imageKey}-segment-${mediaItemIndex}`,
      );
      items.push({
        key: mediaItem.key,
        payload: {
          kind: "inline-media",
          media: mediaItem.media,
          mediaIndex: mediaItem.mediaIndex,
        },
        heightPx: mediaItem.heightPx,
      });
      previousOffsetRatio = mediaItem.offsetRatio;
    });

    pushImageSegment(previousOffsetRatio, 1, `${imageKey}-segment-end`);
  });

  return items;
}

export function buildStoryItemRenderWindow<TPayload>(
  params: BuildStoryItemRenderWindowParams<TPayload>,
): StoryItemRenderWindow<TPayload> {
  const itemSpans = params.items.map((item, itemIndex) => ({
    item,
    itemIndex,
    heightPx: normalizedPositiveNumber(item.heightPx),
  }));
  const totalHeightPx = itemSpans.reduce(
    (sum, span) => sum + span.heightPx,
    0,
  );

  if (itemSpans.length === 0 || totalHeightPx <= 0) {
    return { totalHeightPx, blocks: [] };
  }

  const overscanPx = Math.max(0, params.overscanPx);
  const viewportTopPx = Math.max(0, params.viewportTopPx);
  const viewportHeightPx = Math.max(0, params.viewportHeightPx);
  const windowTopPx = Math.max(0, viewportTopPx - overscanPx);
  const windowBottomPx = Math.min(
    totalHeightPx,
    viewportTopPx + viewportHeightPx + overscanPx,
  );
  const blocks: Array<StoryItemRenderBlock<TPayload>> = [];
  let topPx = 0;

  itemSpans.forEach(({ item, itemIndex, heightPx }) => {
    const itemTopPx = topPx;
    const itemBottomPx = itemTopPx + heightPx;
    topPx = itemBottomPx;

    if (heightPx <= 0) return;
    if (itemTopPx >= windowBottomPx || itemBottomPx <= windowTopPx) return;

    blocks.push({
      ...item,
      itemIndex,
      topPx: itemTopPx,
      heightPx,
    });
  });

  return { totalHeightPx, blocks };
}

export function buildStoryRenderWindow<TImage>(
  params: BuildStoryRenderWindowParams<TImage>,
): StoryRenderWindow<TImage> {
  const imageHeightPx =
    Number.isFinite(params.imageHeightPx) && params.imageHeightPx > 0
      ? params.imageHeightPx
      : 0;
  const totalHeightPx = params.images.length * imageHeightPx;

  if (params.images.length === 0 || imageHeightPx <= 0) {
    return { totalHeightPx, blocks: [] };
  }

  const overscanPx = Math.max(0, params.overscanPx);
  const viewportTopPx = Math.max(0, params.viewportTopPx);
  const viewportHeightPx = Math.max(0, params.viewportHeightPx);
  const windowTopPx = Math.max(0, viewportTopPx - overscanPx);
  const windowBottomPx = Math.min(
    totalHeightPx,
    viewportTopPx + viewportHeightPx + overscanPx,
  );
  const startIndex = Math.max(0, Math.floor(windowTopPx / imageHeightPx));
  const endIndex = Math.min(
    params.images.length - 1,
    Math.ceil(windowBottomPx / imageHeightPx) - 1,
  );

  if (endIndex < startIndex) {
    return { totalHeightPx, blocks: [] };
  }

  const blocks: Array<StoryRenderBlock<TImage>> = [];
  for (let imageIndex = startIndex; imageIndex <= endIndex; imageIndex++) {
    const image = params.images[imageIndex];
    blocks.push({
      key: params.getImageKey?.(image, imageIndex) ?? `image-${imageIndex}`,
      image,
      imageIndex,
      topPx: imageIndex * imageHeightPx,
      heightPx: imageHeightPx,
    });
  }

  return { totalHeightPx, blocks };
}
