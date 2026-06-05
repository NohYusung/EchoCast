import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { buildPlayerManifest } from "./domain/player-manifest.builder";
import type { EpisodeDraft, PlayerDraft } from "./domain/player-contract.types";
import { ProductService } from "../products/applications/product.service";

@Injectable()
export class PlayerService {
  private readonly drafts = new Map<string, PlayerDraft>();
  private readonly episodes = new Map<string, EpisodeDraft>();

  constructor(
    @Inject(ProductService)
    private readonly productService: ProductService,
  ) {}

  async getManifest(episodeId: string) {
    const draft = this.findDraft(episodeId);
    if (!draft) {
      throw new NotFoundException(`episode ${episodeId} not found`);
    }

    return buildPlayerManifest(draft);
  }

  async getDraft(episodeId: string) {
    const draft = this.findDraft(episodeId);
    if (!draft) {
      throw new NotFoundException(`episode ${episodeId} not found`);
    }

    return draft;
  }

  async saveDraft(episodeId: string, draft: PlayerDraft) {
    const savedDraft = await this.saveDraftSource(episodeId, draft);
    return {
      draft: savedDraft,
      manifest: buildPlayerManifest(savedDraft),
    };
  }

  async createProduct(input: { title: string; coverImageUrl?: string }) {
    return this.productService.createProduct(input);
  }

  async createEpisode(
    productId: string,
    input: {
      episodeNumber: number;
      title: string;
      subTitle?: string;
    },
  ) {
    if (!(await this.productService.hasProduct(productId))) {
      throw new NotFoundException(`product ${productId} not found`);
    }

    const episode: EpisodeDraft = {
      id: this.nextEpisodeId(),
      productId,
      episodeNumber: input.episodeNumber,
      title: input.title,
      subTitle: input.subTitle,
    };
    this.episodes.set(episode.id, structuredClone(episode));
    return structuredClone(episode);
  }

  private findDraft(episodeId: string) {
    const draft = this.drafts.get(episodeId);
    return draft ? structuredClone(draft) : undefined;
  }

  private async saveDraftSource(episodeId: string, draft: PlayerDraft) {
    const draftToSave = structuredClone({
      ...draft,
      episodes: draft.episodes.map((episode, index) =>
        index === 0 ? { ...episode, id: episodeId } : episode,
      ),
    });

    this.drafts.set(episodeId, draftToSave);
    await this.productService.saveProducts(draftToSave.products);
    for (const episode of draftToSave.episodes) {
      this.episodes.set(episode.id, structuredClone(episode));
    }

    return structuredClone(draftToSave);
  }

  private nextEpisodeId() {
    const maxExistingId = Array.from(this.episodes.values()).reduce(
      (max, episode) => {
        const match = episode.id.match(/^episode-(\d+)$/);
        const numericId = match ? Number(match[1]) : Number.NaN;
        return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
      },
      499,
    );

    return `episode-${maxExistingId + 1}`;
  }
}
