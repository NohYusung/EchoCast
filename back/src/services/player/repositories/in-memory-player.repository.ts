import type {
  EpisodeDraft,
  PlayerDraft,
  ProductDraft,
} from "../domain/player-draft.types";
import { createSamplePlayerDraft } from "../domain/sample-player-draft";

export class InMemoryPlayerRepository {
  private readonly drafts = new Map<string, PlayerDraft>();
  private readonly products = new Map<string, ProductDraft>();
  private readonly episodes = new Map<string, EpisodeDraft>();
  private nextProductNo = 200;
  private nextEpisodeNo = 500;

  constructor() {
    const sampleDraft = createSamplePlayerDraft();
    this.drafts.set("sample-player", sampleDraft);

    for (const product of sampleDraft.products) {
      this.products.set(product.id, product);
    }

    for (const episode of sampleDraft.episodes) {
      this.episodes.set(episode.id, episode);
    }
  }

  findDraft(episodeId: string): PlayerDraft | undefined {
    const draft = this.drafts.get(episodeId);
    return draft ? structuredClone(draft) : undefined;
  }

  saveDraft(episodeId: string, draft: PlayerDraft): PlayerDraft {
    const draftToSave = structuredClone({
      ...draft,
      episodes: draft.episodes.map((episode, index) =>
        index === 0 ? { ...episode, id: episodeId } : episode,
      ),
    });
    this.drafts.set(episodeId, draftToSave);
    return structuredClone(draftToSave);
  }

  createProduct(input: {
    title: string;
    coverImageUrl?: string;
  }): ProductDraft {
    const product: ProductDraft = {
      id: `product-${this.nextProductNo++}`,
      title: input.title,
      coverImageUrl: input.coverImageUrl,
    };
    this.products.set(product.id, product);
    return structuredClone(product);
  }

  createEpisode(
    productId: string,
    input: {
      episodeNumber: number;
      title: string;
      subTitle?: string;
    },
  ): EpisodeDraft {
    if (!this.products.has(productId)) {
      throw new Error(`product ${productId} not found`);
    }

    const episode: EpisodeDraft = {
      id: `episode-${this.nextEpisodeNo++}`,
      productId,
      episodeNumber: input.episodeNumber,
      title: input.title,
      subTitle: input.subTitle,
    };
    this.episodes.set(episode.id, episode);
    return structuredClone(episode);
  }
}
