import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';

test('POST /auth/signup creates a user and rejects duplicate email signup', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const email = `signup-${Date.now()}@example.com`;
        const signupResponse = await request(app.getHttpServer())
            .post('/auth/signup')
            .send({
                email,
                password: 'password-1234',
                name: '회원가입 테스트',
                nickname: 'signup',
                profileImageUrl: 'https://assets.example.com/signup.png',
            })
            .expect(201);

        assert.deepEqual(signupResponse.body, { data: {} });

        await request(app.getHttpServer())
            .post('/auth/signup')
            .send({
                email,
                password: 'password-1234',
                name: '중복 회원',
            })
            .expect(409);
    } finally {
        await app.close();
    }
});

test('POST /auth/signIn returns an access token for a signed up user', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const email = `sign-in-${Date.now()}@example.com`;
        await request(app.getHttpServer())
            .post('/auth/signup')
            .send({
                email,
                password: 'password-1234',
                name: '로그인 테스트',
            })
            .expect(201);

        const signInResponse = await request(app.getHttpServer())
            .post('/auth/signIn')
            .send({
                email,
                password: 'password-1234',
            })
            .expect(200);

        assert.equal(typeof signInResponse.body.data.accessToken, 'string');
        assert.equal(signInResponse.body.data.accessToken.split('.').length, 3);
        assert.equal(signInResponse.body.data.user.email, email);

        await request(app.getHttpServer())
            .post('/auth/signIn')
            .send({
                email,
                password: 'wrong-password',
            })
            .expect(401);
    } finally {
        await app.close();
    }
});
