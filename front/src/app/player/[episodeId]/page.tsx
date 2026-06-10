import { PlayerRuntime } from '../../_lib/player/PlayerRuntime';

export default async function PlayerPage({ params }: { params: Promise<{ episodeId: string }> }) {
    const { episodeId } = await params;

    return <PlayerRuntime episodeId={episodeId} />;
}
