import { getPlayerManifest } from "../../../../../_lib/player/getPlayerManifest";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ productId: string; episodeId: string }>;
}) {
  const { productId, episodeId } = await params;
  const manifest = await getPlayerManifest(episodeId);

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Studio</p>
          <h1>{productId}</h1>
        </div>
        <span>{manifest.durationMs}ms</span>
      </section>
      <section className="timeline">
        {manifest.items.map((item) => (
          <article key={item.id} className={`clip clip-${item.kind}`}>
            <strong>{item.kind}</strong>
            <span>{item.id}</span>
            <small>
              {item.startTime}ms - {item.endTime}ms
            </small>
          </article>
        ))}
      </section>
      <section className="grid">
        <div className="panel">
          <h2>Cues</h2>
          <ol>
            {manifest.cues.map((cue) => (
              <li key={cue.id}>
                {cue.id} · {cue.startTime}ms ·{" "}
                {cue.approvedRecordUrl ? "approved record" : "tts fallback"}
              </li>
            ))}
          </ol>
        </div>
        <div className="panel">
          <h2>Media Bin</h2>
          <ol>
            {manifest.media.map((media) => (
              <li key={media.id}>
                {media.kind} · {media.id}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
