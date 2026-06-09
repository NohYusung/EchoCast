import type { PlayerDraft } from './playerDraft.types';
import type { PlayerManifest } from './playerManifest.types';

export interface TimelineItemTimingUpdate {
    itemId: string;
    startTime: number;
    endTime: number;
}

export function applyTimelineItemTimings(draft: PlayerDraft, updates: TimelineItemTimingUpdate[]): PlayerDraft {
    const updateById = new Map(updates.map((update) => [update.itemId, update]));
    const cueTimingById = new Map<string, TimelineItemTimingUpdate>();
    for (const item of draft.timelineItems) {
        const update = updateById.get(item.id);
        if (update && item.kind === 'cue' && item.cueId) {
            cueTimingById.set(item.cueId, update);
        }
    }

    return {
        ...draft,
        timelineItems: draft.timelineItems.map((item) => {
            const update = updateById.get(item.id);
            if (!update) return { ...item };

            return {
                ...item,
                startTime: update.startTime,
                endTime: update.endTime,
            };
        }),
        cues: draft.cues.map((cue) => {
            const update = cueTimingById.get(cue.id);
            if (!update) return { ...cue };

            return {
                ...cue,
                startTime: update.startTime,
                endTime: update.endTime,
            };
        }),
    };
}

export async function saveTimelineItemTimings({
    apiBaseUrl,
    episodeId,
    updates,
    fallbackDraft,
    fetchImpl = fetch,
}: {
    apiBaseUrl: string;
    episodeId: string;
    updates: TimelineItemTimingUpdate[];
    fallbackDraft?: PlayerDraft;
    fetchImpl?: typeof fetch;
}): Promise<PlayerManifest> {
    const draftResponse = await fetchImpl(`${apiBaseUrl}/episodes/${episodeId}/player-draft`);
    if (!draftResponse.ok && !fallbackDraft) {
        throw new Error(`draft load failed: ${draftResponse.status}`);
    }

    const draft = draftResponse.ok ? ((await draftResponse.json()) as PlayerDraft) : structuredClone(fallbackDraft!);
    const updatedDraft = applyTimelineItemTimings(draft, updates);
    const saveResponse = await fetchImpl(`${apiBaseUrl}/episodes/${episodeId}/player-draft`, {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(updatedDraft),
    });

    if (!saveResponse.ok) {
        throw new Error(`draft save failed: ${saveResponse.status}`);
    }

    const payload = (await saveResponse.json()) as { manifest: PlayerManifest };
    return payload.manifest;
}
