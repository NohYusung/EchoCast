import { Module } from "@nestjs/common";
import { CharacterRepository } from "./repository/characater.repository";

@Module({
  imports: [],
  controllers: [],
  providers: [CharacterRepository],
  exports: [CharacterRepository],
})
export class CharacterModule {}
