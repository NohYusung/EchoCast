"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchLocalPlayerIndex,
  type LocalPlayerIndexItem,
} from "@/lib/localPlayerContent";

export default function HomePage() {
  const [players, setPlayers] = useState<LocalPlayerIndexItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocalPlayerIndex()
      .then(setPlayers)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  return (
    <main className="test-home">
      <section className="test-home__header">
        <h1>test-player</h1>
        <p>로컬 JSON으로 vogopang player를 실행합니다.</p>
      </section>

      {error ? <p className="test-home__error">{error}</p> : null}

      <section className="test-home__grid" aria-label="플레이어 샘플 목록">
        {players.map((player) => (
          <Link
            key={player.playerKey}
            className="test-home__card"
            href={`/player/${player.playerKey}?headerTitle=${encodeURIComponent(
              player.title,
            )}&headerSubtitle=${encodeURIComponent(player.subtitle ?? "로컬 테스트")}`}
          >
            <span className="test-home__title">{player.title}</span>
            <span className="test-home__subtitle">{player.subtitle ?? player.playerKey}</span>
            <span className="test-home__key">{player.playerKey}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
