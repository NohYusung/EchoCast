import { Injectable } from "@nestjs/common";
import type {
  EpisodeDraft,
  PlayerDraft,
  ProductDraft,
} from "../domain/player-draft.types";

@Injectable()
export class PlayerRepository {
  private readonly drafts = new Map<string, PlayerDraft>();
  private readonly products = new Map<string, ProductDraft>();
  private readonly episodes = new Map<string, EpisodeDraft>();

  async findDraft(episodeId: string): Promise<PlayerDraft | undefined> {
    const draft = this.drafts.get(episodeId);
    return draft ? structuredClone(draft) : undefined;
  }

  async saveDraft(episodeId: string, draft: PlayerDraft): Promise<PlayerDraft> {
    const draftToSave = structuredClone({
      ...draft,
      episodes: draft.episodes.map((episode, index) =>
        index === 0 ? { ...episode, id: episodeId } : episode,
      ),
    });

    this.drafts.set(episodeId, draftToSave);
    for (const product of draftToSave.products) {
      this.products.set(product.id, structuredClone(product));
    }
    for (const episode of draftToSave.episodes) {
      this.episodes.set(episode.id, structuredClone(episode));
    }

    return structuredClone(draftToSave);
  }

  async createProduct(input: {
    title: string;
    coverImageUrl?: string;
  }): Promise<ProductDraft> {
    const product: ProductDraft = {
      id: this.nextId({
        prefix: "product",
        minimum: 200,
        rows: Array.from(this.products.values()),
      }),
      title: input.title,
      coverImageUrl: input.coverImageUrl,
    };

    this.products.set(product.id, structuredClone(product));
    return structuredClone(product);
  }

  async createEpisode(
    productId: string,
    input: {
      episodeNumber: number;
      title: string;
      subTitle?: string;
    },
  ): Promise<EpisodeDraft | undefined> {
    if (!this.products.has(productId)) return undefined;

    const episode: EpisodeDraft = {
      id: this.nextId({
        prefix: "episode",
        minimum: 500,
        rows: Array.from(this.episodes.values()),
      }),
      productId,
      episodeNumber: input.episodeNumber,
      title: input.title,
      subTitle: input.subTitle,
    };

    this.episodes.set(episode.id, structuredClone(episode));
    return structuredClone(episode);
  }

  private nextId({
    prefix,
    minimum,
    rows,
  }: {
    prefix: "product" | "episode";
    minimum: number;
    rows: Array<{ id: string }>;
  }): string {
    const maxExistingId = rows.reduce((max, row) => {
      const match = row.id.match(new RegExp(`^${prefix}-(\\d+)$`));
      const numericId = match ? Number(match[1]) : Number.NaN;
      return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
    }, minimum - 1);

    return `${prefix}-${maxExistingId + 1}`;
  }
}
