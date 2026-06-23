import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabasesModule } from '../../databases';
import { UserRepository } from '../users/repository/user.repository';
import { AuthService } from './applications/auth.service';
import { AuthController } from './controllers/auth.controller';

@Module({
    imports: [DatabasesModule],
    controllers: [AuthController],
    providers: [
        {
            provide: UserRepository,
            inject: [DataSource],
            useFactory: (dataSource: DataSource) => new UserRepository(dataSource),
        },
        {
            provide: AuthService,
            inject: [UserRepository],
            useFactory: (userRepository: UserRepository) => new AuthService(userRepository),
        },
    ],
    exports: [AuthService],
})
export class AuthModule {}
