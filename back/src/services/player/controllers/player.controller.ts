import { Body, Controller, Get, Inject, Param, Post, Put } from "@nestjs/common";
import { PlayerService } from "../player.service";
import type { PlayerDraft } from "../domain/player-contract.types";
import { ProductService } from "../../products/applications/product.service";

@Controller()
export class PlayerController {
  constructor(
    @Inject(PlayerService)
    private readonly playerService: PlayerService,
    @Inject(ProductService)
    private readonly productService: ProductService,
  ) {}

  @Get("/health")
  getHealth() {
    return { status: "ok" };
  }

  @Get("/player/manifest/:episodeId")
  getManifest(@Param("episodeId") episodeId: string) {
    return this.playerService.getManifest(episodeId);
  }

  @Get("/episodes/:episodeId/player-draft")
  getPlayerDraft(@Param("episodeId") episodeId: string) {
    return this.playerService.getDraft(episodeId);
  }

  @Put("/episodes/:episodeId/player-draft")
  savePlayerDraft(
    @Param("episodeId") episodeId: string,
    @Body() draft: PlayerDraft,
  ) {
    return this.playerService.saveDraft(episodeId, draft);
  }

  @Post("/products")
  createProduct(
    @Body()
    body: {
      title: string;
      coverImageUrl?: string;
    },
  ) {
    return this.productService.createProduct(body);
  }

  @Post("/products/:productId/episodes")
  createEpisode(
    @Param("productId") productId: string,
    @Body()
    body: {
      episodeNumber: number;
      title: string;
      subTitle?: string;
    },
  ) {
    return this.playerService.createEpisode(productId, body);
  }
}
