import Link from 'next/link';

export default function HomePage() {
    return (
        <main className="shell">
            <section className="toolbar">
                <h1>test-player</h1>
                <nav>
                    <Link href="/studio/products">Products</Link>
                    <Link href="/studio/products/1/episodes">Episodes</Link>
                    <Link href="/studio/products/1/episodes/1">Studio</Link>
                    <Link href="/direction/screen/1/1">Direction</Link>
                    <Link href="/player/1">Player</Link>
                </nav>
            </section>
        </main>
    );
}
