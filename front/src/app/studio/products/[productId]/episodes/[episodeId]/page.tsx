import { getEpisodeDetails } from '../../../../../_lib/player/getEpisodeDetails';
import { getPlayerDraft } from '../../../../../_lib/player/getPlayerDraft';
import { getPlayerManifest } from '../../../../../_lib/player/getPlayerManifest';
import { StudioEditor } from '../../../../../_lib/player/StudioEditor';

export default async function StudioPage({ params }: { params: Promise<{ productId: string; episodeId: string }> }) {
    const { productId, episodeId } = await params;
    const [manifest, draft, episode] = await Promise.all([
        getPlayerManifest(episodeId),
        getPlayerDraft({ productId, episodeId }),
        getEpisodeDetails({ productId, episodeId }),
    ]);

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    return (
        <StudioEditor
            apiBaseUrl={apiBaseUrl}
            episode={episode}
            episodeId={episodeId}
            productId={productId}
            initialDraft={draft}
            initialManifest={manifest}
        />
    );
}
