import assert from 'node:assert/strict';
import test from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FileService } from '../applications/file.service';
import { FileController } from '../controllers/file.controller';

test('POST /files/uploadUrls forwards file content types to the upload URL service', async () => {
    const files = [
        {
            key: 'episodes/1/media/clip.mov',
            contentType: 'video/quicktime',
        },
    ];
    let received: unknown;
    const fileService = {
        async getUploadUrls(args: unknown) {
            received = args;
            return [
                {
                    publicUrl: 'https://assets.example.com/episodes/1/media/clip.mov',
                    mimetype: 'video/quicktime',
                    presignedUrl: 'https://uploads.example.com/episodes/1/media/clip.mov',
                },
            ];
        },
    };
    const moduleRef = await Test.createTestingModule({
        controllers: [FileController],
        providers: [
            {
                provide: FileService,
                useValue: fileService,
            },
        ],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    try {
        const response = await request(app.getHttpServer()).post('/files/uploadUrls').send({ files }).expect(201);

        assert.deepEqual(received, { files });
        assert.deepEqual(response.body, {
            data: [
                {
                    publicUrl: 'https://assets.example.com/episodes/1/media/clip.mov',
                    mimetype: 'video/quicktime',
                    presignedUrl: 'https://uploads.example.com/episodes/1/media/clip.mov',
                },
            ],
        });
    } finally {
        await app.close();
    }
});
