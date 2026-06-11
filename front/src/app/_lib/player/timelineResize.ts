type TimelineSidebarResizeArgs = {
    originalWidth: number;
    pointerStartX: number;
    pointerCurrentX: number;
    minWidth: number;
    maxWidth: number;
};

export function getTimelineSidebarResizeWidth({
    originalWidth,
    pointerStartX,
    pointerCurrentX,
    minWidth,
    maxWidth,
}: TimelineSidebarResizeArgs) {
    const nextWidth = originalWidth + (pointerCurrentX - pointerStartX);

    return Math.round(Math.min(Math.max(nextWidth, minWidth), maxWidth));
}
