import { redirect } from 'next/navigation';
import { PlayerRuntime } from '../../_lib/player/PlayerRuntime';
import { getPlayerManifest } from '../../_lib/player/getPlayerManifest';

export default async function PlayerPage({ params }: { params: Promise<{ episodeId: string }> }) {
    const { episodeId } = await params;
    const parsedEpisodeId = Number.parseInt(episodeId, 10);

    if (!Number.isFinite(parsedEpisodeId) || parsedEpisodeId <= 0) {
        redirect('/player/1');
    }

    const manifest = await getPlayerManifest(String(parsedEpisodeId));

    return <PlayerRuntime episodeId={String(parsedEpisodeId)} manifest={manifest} />;
}
