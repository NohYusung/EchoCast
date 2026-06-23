import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../users/domain/user.entity';
import { UserRepository } from '../../users/repository/user.repository';
import { AuthService } from './auth.service';

describe('AuthService', () => {
    it('signs up a user with normalized email and hashed password', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [User],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const userRepository = new UserRepository(dataSource);
            const authService = new AuthService(userRepository);

            const created = await authService.signup({
                email: '  Studio-User@Example.COM  ',
                password: 'password-1234',
                name: '  스튜디오 유저  ',
                nickname: '  studio  ',
                profileImageUrl: '  https://assets.example.com/profile.png  ',
            });
            const [storedUser] = await userRepository.find({ id: created.id });

            assert.deepEqual(created, {
                id: storedUser.id,
                email: 'studio-user@example.com',
                name: '스튜디오 유저',
                nickname: 'studio',
                profileImageUrl: 'https://assets.example.com/profile.png',
                status: 'active',
            });
            assert.notEqual(storedUser.password, 'password-1234');
            assert.match(storedUser.password, /^scrypt:/);
        } finally {
            await dataSource.destroy();
        }
    });

    it('rejects duplicate signup email', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [User],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const userRepository = new UserRepository(dataSource);
            const authService = new AuthService(userRepository);

            await authService.signup({
                email: 'duplicate@example.com',
                password: 'password-1234',
                name: '첫 번째 회원',
            });

            await assert.rejects(
                () =>
                    authService.signup({
                        email: ' DUPLICATE@example.com ',
                        password: 'password-1234',
                        name: '두 번째 회원',
                    }),
                (error: unknown) => error instanceof ConflictException
            );
        } finally {
            await dataSource.destroy();
        }
    });

    it('rejects missing required signup fields', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [User],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const userRepository = new UserRepository(dataSource);
            const authService = new AuthService(userRepository);

            await assert.rejects(
                () =>
                    authService.signup({
                        email: ' ',
                        password: 'password-1234',
                        name: '회원',
                    }),
                (error: unknown) => error instanceof BadRequestException
            );
            await assert.rejects(
                () =>
                    authService.signup({
                        email: 'missing-password@example.com',
                        password: ' ',
                        name: '회원',
                    }),
                (error: unknown) => error instanceof BadRequestException
            );
            await assert.rejects(
                () =>
                    authService.signup({
                        email: 'missing-name@example.com',
                        password: 'password-1234',
                        name: ' ',
                    }),
                (error: unknown) => error instanceof BadRequestException
            );
        } finally {
            await dataSource.destroy();
        }
    });
});
