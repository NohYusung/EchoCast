import { Module } from "@nestjs/common";
import { TrackRepository } from "./repository/track.repository";

@Module({
  imports: [],
  controllers: [],
  providers: [TrackRepository],
  exports: [TrackRepository],
})
export class TrackModule {}
