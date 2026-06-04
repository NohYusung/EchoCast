import "reflect-metadata";
import { Module } from "@nestjs/common";
import { PlayerModule } from "./services/player/player.module";

@Module({
  imports: [PlayerModule],
})
export class AppModule {}
