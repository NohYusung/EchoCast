import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
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

    it('signs in a signed up user and returns an access token with public user fields', async () => {
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
                email: 'sign-in-user@example.com',
                password: 'password-1234',
                name: '로그인 유저',
                nickname: 'sign-in',
            });

            const signedIn = await authService.signIn({
                email: '  SIGN-IN-USER@example.com  ',
                password: 'password-1234',
            });
            const [, encodedPayload] = signedIn.accessToken.split('.');
            const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
                userId: number;
                email: string;
            };

            assert.equal(signedIn.accessToken.split('.').length, 3);
            assert.equal(signedIn.user.email, 'sign-in-user@example.com');
            assert.equal(signedIn.user.name, '로그인 유저');
            assert.equal(signedIn.user.nickname, 'sign-in');
            assert.equal(payload.userId, signedIn.user.id);
            assert.equal(payload.email, 'sign-in-user@example.com');
        } finally {
            await dataSource.destroy();
        }
    });

    it('rejects sign in with an unknown email or wrong password', async () => {
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
                email: 'sign-in-fail@example.com',
                password: 'password-1234',
                name: '로그인 실패 유저',
            });

            await assert.rejects(
                () =>
                    authService.signIn({
                        email: 'missing@example.com',
                        password: 'password-1234',
                    }),
                (error: unknown) => error instanceof UnauthorizedException
            );
            await assert.rejects(
                () =>
                    authService.signIn({
                        email: 'sign-in-fail@example.com',
                        password: 'wrong-password',
                    }),
                (error: unknown) => error instanceof UnauthorizedException
            );
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
