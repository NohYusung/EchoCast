import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { buildPlayerManifest } from "./domain/player-manifest.builder";
import type { PlayerDraft } from "./domain/player-draft.types";
import { InMemoryPlayerRepository } from "./repositories/in-memory-player.repository";

@Injectable()
export class PlayerService {
  constructor(
    @Inject(InMemoryPlayerRepository)
    private readonly playerRepository: InMemoryPlayerRepository,
  ) {}

  getManifest(episodeId: string) {
    const draft = this.playerRepository.findDraft(episodeId);
    if (!draft) {
      throw new NotFoundException(`episode ${episodeId} not found`);
    }

    return buildPlayerManifest(draft);
  }

  getDraft(episodeId: string) {
    const draft = this.playerRepository.findDraft(episodeId);
    if (!draft) {
      throw new NotFoundException(`episode ${episodeId} not found`);
    }

    return draft;
  }

  saveDraft(episodeId: string, draft: PlayerDraft) {
    const savedDraft = this.playerRepository.saveDraft(episodeId, draft);
    return {
      draft: savedDraft,
      manifest: buildPlayerManifest(savedDraft),
    };
  }

  createProduct(input: { title: string; coverImageUrl?: string }) {
    return this.playerRepository.createProduct(input);
  }

  createEpisode(
    productId: string,
    input: {
      episodeNumber: number;
      title: string;
      subTitle?: string;
    },
  ) {
    return this.playerRepository.createEpisode(productId, input);
  }
}
