import { loadEditorInitialManifest } from '../../../../../_lib/player/editorInitialManifest';
import { getEpisodeDetails } from '../../../../../_lib/player/getEpisodeDetails';
import { getPlayerDraft } from '../../../../../_lib/player/getPlayerDraft';
import { getPlayerManifest } from '../../../../../_lib/player/getPlayerManifest';
import { StudioEditor } from '../../../../../_lib/player/StudioEditor';

export default async function StudioPage({ params }: { params: Promise<{ productId: string; episodeId: string }> }) {
    const { productId, episodeId } = await params;
    const episode = await getEpisodeDetails({ productId, episodeId });
    const manifest = await loadEditorInitialManifest({
        episodeId,
        episode,
        loadManifest: getPlayerManifest,
    });
    const draft = await getPlayerDraft({ productId, episodeId, initialManifest: manifest });

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
