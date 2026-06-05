import { getVogopangPlayerInfo } from "../../_lib/player/getVogopangPlayerInfo";
import { PlayerRuntime } from "../../_lib/player/PlayerRuntime";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  const playerInfo = await getVogopangPlayerInfo({ episodeId });

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Vogopang Player</p>
          <h1>{episodeId}</h1>
        </div>
        <span>{playerInfo.content.format_version}</span>
      </section>
      <PlayerRuntime content={playerInfo.content} episodeId={episodeId} />
    </main>
  );
}
