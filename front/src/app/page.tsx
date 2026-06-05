import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="toolbar">
        <h1>test-player</h1>
        <nav>
          <Link href="/direction/screen/product-100/sample-player">
            Direction
          </Link>
          <Link href="/player/sample-player">Player</Link>
        </nav>
      </section>
    </main>
  );
}
