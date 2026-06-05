import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { PlayerDraft } from "../domain/player-draft.types";
import { PlayerRepository } from "../repository/player.repository";

describe("PlayerRepository", () => {
  let repository: PlayerRepository;

  beforeEach(() => {
    repository = new PlayerRepository();
  });

  it("starts without a sample draft", async () => {
    const draft = await repository.findDraft("sample-player");
    assert.equal(draft, undefined);
  });

  it("returns cloned drafts from memory", async () => {
    const draftToSave: PlayerDraft = {
      products: [
        {
          id: "product-200",
          title: "테스트 작품",
        },
      ],
      episodes: [
        {
          id: "episode-500",
          productId: "product-200",
          episodeNumber: 1,
          title: "1화",
        },
      ],
      characters: [],
      scripts: [],
      tracks: [],
      timelineItems: [],
      media: [],
      ttsVoices: [],
      cues: [],
      records: [],
    };
    await repository.saveDraft("episode-500", draftToSave);

    const draft = await repository.findDraft("episode-500");
    assert.ok(draft);

    draft.products[0].title = "mutated";

    const nextDraft = await repository.findDraft("episode-500");
    assert.equal(nextDraft?.products[0].title, "테스트 작품");
  });

  it("creates products with stable generated ids", async () => {
    const product = await repository.createProduct({ title: "신규 작품" });

    assert.deepEqual(product, {
      id: "product-200",
      title: "신규 작품",
      coverImageUrl: undefined,
    });
  });

  it("creates episodes only for existing products", async () => {
    const missingEpisode = await repository.createEpisode("missing-product", {
      episodeNumber: 1,
      title: "없는 작품의 회차",
    });
    assert.equal(missingEpisode, undefined);

    const product = await repository.createProduct({ title: "신규 작품" });
    const episode = await repository.createEpisode(product.id, {
      episodeNumber: 1,
      title: "1화",
      subTitle: "테스트",
    });

    assert.deepEqual(episode, {
      id: "episode-500",
      productId: product.id,
      episodeNumber: 1,
      title: "1화",
      subTitle: "테스트",
    });
  });
});
