import { getEpisodeDetails } from '../../../../../_lib/player/getEpisodeDetails';
import { getPlayerDraft } from '../../../../../_lib/player/getPlayerDraft';
import { getPlayerManifest } from '../../../../../_lib/player/getPlayerManifest';
import { StudioEditor } from '../../../../../_lib/player/StudioEditor';

/*
AGENT
- studio/products/:productId/episodes/:episodeId 화면은 episode retrieve, player draft, player manifest API 응답을 기준으로 초기화한다.
- mock fallback이 필요하면 route가 아니라 각 fetch helper 내부에서만 처리한다.
*/
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
