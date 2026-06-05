import { Module } from "@nestjs/common";
import { CueRepository } from "./repository/cue.repository";

@Module({
  imports: [],
  controllers: [],
  providers: [CueRepository],
  exports: [CueRepository],
})
export class CueModule {}
