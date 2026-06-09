import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { CharacterService } from './applications/characater.service';
import { CharacterController } from './controllers/character.controller';
import { CharacterRepository } from './repository/characater.repository';

@Module({
    imports: [DatabasesModule],
    controllers: [CharacterController],
    providers: [
        {
            provide: CharacterRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new CharacterRepository(dataSource),
        },
        {
            provide: CharacterService,
            inject: [CharacterRepository],
            useFactory: (characterRepository: CharacterRepository) => new CharacterService(characterRepository),
        },
    ],
    exports: [CharacterRepository, CharacterService],
})
export class CharacterModule {}
