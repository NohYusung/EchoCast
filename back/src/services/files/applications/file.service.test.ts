import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AwsS3Service } from '../../../libs/aws';
import { FileService } from './file.service';

describe('FileService', () => {
    it('passes explicit upload content types to S3 and returns the upload URL contract', async () => {
        const files = [
            {
                key: 'episodes/1/media/clip.mov',
                contentType: 'video/quicktime',
            },
        ];
        let received: unknown;
        const awsS3Service = {
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
        } as unknown as AwsS3Service;
        const fileService = new FileService(awsS3Service);

        const result = await (fileService as any).getUploadUrls({ files });

        assert.deepEqual(received, { files });
        assert.deepEqual(result, [
            {
                publicUrl: 'https://assets.example.com/episodes/1/media/clip.mov',
                mimetype: 'video/quicktime',
                presignedUrl: 'https://uploads.example.com/episodes/1/media/clip.mov',
            },
        ]);
    });
});
