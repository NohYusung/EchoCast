import { Module } from "@nestjs/common";
import { PlayerController } from "./controllers/player.controller";
import { InMemoryPlayerRepository } from "./repositories/in-memory-player.repository";
import { PlayerService } from "./player.service";

@Module({
  controllers: [PlayerController],
  providers: [InMemoryPlayerRepository, PlayerService],
})
export class PlayerModule {}
