import { Module } from "@nestjs/common";
import { EpisodeRepository } from "./repository/episode.repository";

@Module({
  imports: [],
  controllers: [],
  providers: [EpisodeRepository],
  exports: [EpisodeRepository],
})
export class EpisodeModule {}
