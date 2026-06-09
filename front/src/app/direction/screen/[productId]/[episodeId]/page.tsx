import { getPlayerDraft } from '../../../../_lib/player/getPlayerDraft';
import { getPlayerManifest } from '../../../../_lib/player/getPlayerManifest';
import { StudioEditor } from '../../../../_lib/player/StudioEditor';

export default async function DirectionScreenPage({
    params,
}: {
    params: Promise<{ productId: string; episodeId: string }>;
}) {
    const { productId, episodeId } = await params;
    const manifest = await getPlayerManifest(episodeId);
    const draft = await getPlayerDraft({ productId, episodeId });
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    return (
        <StudioEditor apiBaseUrl={apiBaseUrl} episodeId={episodeId} initialDraft={draft} initialManifest={manifest} />
    );
}
