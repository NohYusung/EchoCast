import { Module } from "@nestjs/common";
import { MediaRepository } from "./repository/media.repository";

@Module({
  imports: [],
  controllers: [],
  providers: [MediaRepository],
  exports: [MediaRepository],
})
export class MediaModule {}
