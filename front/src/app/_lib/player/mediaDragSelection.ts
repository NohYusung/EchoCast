export type MediaDragPayload = {
    ids: number[];
    primaryId?: number;
};

function uniquePositiveIds(ids: readonly number[]) {
    const seen = new Set<number>();
    const result: number[] = [];

    ids.forEach((id) => {
        if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
            return;
        }

        seen.add(id);
        result.push(id);
    });

    return result;
}

export function getNextMediaSelection({
    currentSelectionIds,
    clickedId,
    orderedMediaIds,
    isToggle,
    isRange,
}: {
    currentSelectionIds: readonly number[];
    clickedId: number;
    orderedMediaIds: readonly number[];
    isToggle: boolean;
    isRange: boolean;
}) {
    if (isRange && currentSelectionIds.length > 0) {
        const anchorId = currentSelectionIds[currentSelectionIds.length - 1];
        const anchorIndex = orderedMediaIds.indexOf(anchorId);
        const clickedIndex = orderedMediaIds.indexOf(clickedId);

        if (anchorIndex >= 0 && clickedIndex >= 0) {
            const startIndex = Math.min(anchorIndex, clickedIndex);
            const endIndex = Math.max(anchorIndex, clickedIndex);

            return orderedMediaIds.slice(startIndex, endIndex + 1);
        }
    }

    if (isToggle) {
        if (currentSelectionIds.includes(clickedId)) {
            return currentSelectionIds.filter((id) => id !== clickedId);
        }

        return uniquePositiveIds([...currentSelectionIds, clickedId]);
    }

    return clickedId > 0 ? [clickedId] : [];
}

export function buildMediaDragPayload(ids: readonly number[]): MediaDragPayload {
    const selectedIds = uniquePositiveIds(ids);

    return {
        ids: selectedIds,
        primaryId: selectedIds[0],
    };
}

export function parseMediaDragPayload(batchPayload: string, singlePayload: string) {
    if (batchPayload.trim()) {
        try {
            const parsed = JSON.parse(batchPayload) as unknown;

            if (Array.isArray(parsed)) {
                return uniquePositiveIds(parsed.map((id) => Number(id)));
            }
        } catch {
            return [];
        }
    }

    return uniquePositiveIds([Number(singlePayload)]);
}
