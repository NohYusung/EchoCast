import assert from 'node:assert/strict';
import test from 'node:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { HealthController } from './health.controller';

test('GET /health returns an ok status for load balancer checks', async () => {
    const moduleRef = await Test.createTestingModule({
        controllers: [HealthController],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const response = await request(app.getHttpServer()).get('/health').expect(200);

        assert.deepEqual(response.body, { data: { status: 'ok' } });
    } finally {
        await app.close();
    }
});
