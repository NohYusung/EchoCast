import { getEpisodeDetails } from '../../../../../../_lib/player/getEpisodeDetails';
import { getPlayerDraft } from '../../../../../../_lib/player/getPlayerDraft';
import { getPlayerManifest } from '../../../../../../_lib/player/getPlayerManifest';
import { StudioRecordDashboard } from '../../../../../../_lib/studioCatalog/StudioRecordDashboard';

export default async function StudioRecordPage({ params }: { params: Promise<{ productId: string; episodeId: string }> }) {
    const { productId, episodeId } = await params;
    const [manifest, draft, episode] = await Promise.all([
        getPlayerManifest(episodeId),
        getPlayerDraft({ productId, episodeId }),
        getEpisodeDetails({ productId, episodeId }),
    ]);

    return <StudioRecordDashboard draft={draft} episode={episode} episodeId={episodeId} manifest={manifest} productId={productId} />;
}
