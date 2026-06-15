export type CutCanvasIdentity = {
    id: number;
};

export function resolveCreatedCanvasId(
    previousItems: CutCanvasIdentity[],
    nextItems: CutCanvasIdentity[],
): number | null {
    const previousIds = new Set(previousItems.map((item) => item.id));
    const createdItem = nextItems.find((item) => !previousIds.has(item.id));

    return createdItem?.id ?? nextItems[nextItems.length - 1]?.id ?? null;
}
