import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { PlayerDraft } from "../domain/player-contract.types";
import { PlayerService } from "../player.service";
import { ProductService } from "../../products/applications/product.service";
import { ProductRepository } from "../../products/repository/product.repository";

describe("PlayerService prototype state", () => {
  let playerService: PlayerService;
  let productService: ProductService;
  let productRepository: ProductRepository;

  beforeEach(() => {
    productRepository = new ProductRepository();
    productService = new ProductService(productRepository);
    playerService = new PlayerService(productService);
  });

  it("starts without a sample draft", async () => {
    await assert.rejects(
      () => playerService.getDraft("sample-player"),
      NotFoundException,
    );
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
    await playerService.saveDraft("episode-500", draftToSave);

    const draft = await playerService.getDraft("episode-500");
    draft.products[0].title = "mutated";

    const nextDraft = await playerService.getDraft("episode-500");
    assert.equal(nextDraft.products[0].title, "테스트 작품");
  });

  it("creates products with stable generated ids", async () => {
    const product = await productService.createProduct({ title: "신규 작품" });

    assert.deepEqual(product, {
      id: "product-200",
      title: "신규 작품",
      coverImageUrl: undefined,
    });
  });

  it("creates episodes only for existing products", async () => {
    await assert.rejects(
      () =>
        playerService.createEpisode("missing-product", {
          episodeNumber: 1,
          title: "없는 작품의 회차",
        }),
      NotFoundException,
    );

    const product = await productService.createProduct({ title: "신규 작품" });
    const episode = await playerService.createEpisode(product.id, {
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
