import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { buildPlayerManifest } from "../domain/player-manifest.builder";
import type { PlayerDraft } from "../domain/player-draft.types";
import { buildVogopangContent } from "../domain/vogopang-content.builder";
import { PlayerRepository } from "../repository/player.repository";

@Injectable()
export class PlayerService {
  constructor(
    @Inject(PlayerRepository)
    private readonly playerRepository: PlayerRepository,
  ) {}

  async getManifest({ episodeId }: { episodeId: string }) {
    const draft = await this.playerRepository.findDraft(episodeId);
    if (!draft) {
      throw new NotFoundException(`episode ${episodeId} not found`);
    }

    return buildPlayerManifest(draft);
  }

  async getDraft({ episodeId }: { episodeId: string }) {
    const draft = await this.playerRepository.findDraft(episodeId);
    if (!draft) {
      throw new NotFoundException(`episode ${episodeId} not found`);
    }

    return draft;
  }

  async saveDraft({
    episodeId,
    draft,
  }: {
    episodeId: string;
    draft: PlayerDraft;
  }) {
    const draftForEpisode: PlayerDraft = structuredClone({
      ...draft,
      episodes: draft.episodes.map((episode, index) =>
        index === 0 ? { ...episode, id: episodeId } : episode,
      ),
    });
    let manifest;
    try {
      manifest = buildPlayerManifest(draftForEpisode);
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const savedDraft = await this.playerRepository.saveDraft(
      episodeId,
      draftForEpisode,
    );
    return {
      draft: savedDraft,
      manifest,
    };
  }

  async getPlayerInfo({
    episodeId,
  }: {
    productId?: string;
    episodeId: string;
  }) {
    const draft = await this.playerRepository.findDraft(episodeId);
    if (!draft) {
      throw new NotFoundException(`episode ${episodeId} not found`);
    }

    const episode = draft.episodes.find((candidate) => candidate.id === episodeId);
    if (!episode) {
      throw new NotFoundException(`episode ${episodeId} not found`);
    }
    const product = draft.products.find(
      (candidate) => candidate.id === episode.productId,
    );
    if (!product) {
      throw new NotFoundException(`product ${episode.productId} not found`);
    }

    const content = buildVogopangContent(draft);
    return {
      result: {
        data: {
          type: "success",
          product,
          episode: {
            id: episode.id,
            seriesId: product.id,
            title: episode.title,
            chapter: String(episode.episodeNumber),
            thumbnail: product.coverImageUrl ?? "",
          },
          episodes: draft.episodes.map((episodeRow) => ({
            id: episodeRow.id,
            title: episodeRow.title,
            chapter: String(episodeRow.episodeNumber),
            thumbnail: product.coverImageUrl ?? "",
            isRecordingEpisode: draft.cues.some(
              (cue) => cue.episodeId === episodeRow.id,
            ),
          })),
          content,
        },
      },
    };
  }

  async createProduct(input: { title: string; coverImageUrl?: string }) {
    return this.playerRepository.createProduct(input);
  }

  async createEpisode({
    productId,
    episodeNumber,
    title,
    subTitle,
  }: {
    productId: string;
    episodeNumber: number;
    title: string;
    subTitle?: string;
  }) {
    const episode = await this.playerRepository.createEpisode(productId, {
      episodeNumber,
      title,
      subTitle,
    });
    if (!episode) {
      throw new NotFoundException(`product ${productId} not found`);
    }

    return episode;
  }
}
