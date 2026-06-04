import { buildPlaybackEvents } from "../../_lib/player/buildPlaybackEvents";
import { getPlayerManifest } from "../../_lib/player/getPlayerManifest";
import { resolveVisualFrame } from "../../_lib/player/resolveVisualFrame";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  const manifest = await getPlayerManifest(episodeId);
  const frame = resolveVisualFrame(manifest.items, 6000);
  const playbackEvents = buildPlaybackEvents(manifest);

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Player</p>
          <h1>{manifest.episodeId}</h1>
        </div>
        <span>{manifest.durationMs}ms</span>
      </section>
      <section className="grid">
        <div className="panel">
          <h2>Visual</h2>
          <p>mediaId: {frame.mediaId ?? "none"}</p>
          <p>progress: {Math.round(frame.progress * 100)}%</p>
        </div>
        <div className="panel">
          <h2>Audio Events</h2>
          <ol>
            {playbackEvents.map((event) => (
              <li key={event.id}>
                {event.startTime}ms · {event.kind} · {event.sourceId}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
