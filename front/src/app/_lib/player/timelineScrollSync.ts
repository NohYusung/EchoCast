type ScrollSyncTarget = {
    scrollTop: number;
};

export function syncTimelineVerticalScroll(trackHeaderColumn: ScrollSyncTarget | null, scrollTop: number) {
    if (!trackHeaderColumn || trackHeaderColumn.scrollTop === scrollTop) {
        return;
    }

    trackHeaderColumn.scrollTop = scrollTop;
}
