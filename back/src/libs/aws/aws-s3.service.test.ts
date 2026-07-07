import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ConfigsService } from '../../configs';
import { AwsS3Service } from './aws-s3.service';

describe('AwsS3Service', () => {
    it('signs explicit file uploads with the requested content type header', async () => {
        const configsService = {
            get aws() {
                return {
                    bucketName: 'echocast-assets',
                    region: 'us-east-1',
                    awsUrl: 'https://assets.example.com',
                    accessKeyId: 'AKIAEXAMPLE',
                    secretAccessKey: 'secret',
                };
            },
            isLocal() {
                return true;
            },
        } as ConfigsService;
        const awsS3Service = new AwsS3Service(configsService);

        const [uploadUrl] = await (awsS3Service as any).getUploadUrls({
            files: [
                {
                    key: 'episodes/1/media/clip.mov',
                    contentType: 'video/quicktime',
                },
            ],
        });

        const signedHeaders = new URL(uploadUrl.presignedUrl).searchParams.get('X-Amz-SignedHeaders') ?? '';
        assert.match(signedHeaders, /content-type/);
        assert.equal(uploadUrl.mimetype, 'video/quicktime');
    });

    it('keeps legacy key uploads compatible without requiring a content type header', async () => {
        const configsService = {
            get aws() {
                return {
                    bucketName: 'echocast-assets',
                    region: 'us-east-1',
                    awsUrl: 'https://assets.example.com',
                    accessKeyId: 'AKIAEXAMPLE',
                    secretAccessKey: 'secret',
                };
            },
            isLocal() {
                return true;
            },
        } as ConfigsService;
        const awsS3Service = new AwsS3Service(configsService);

        const [uploadUrl] = await awsS3Service.getUploadUrls({
            keys: ['episodes/1/media/cover.png'],
        });

        const signedHeaders = new URL(uploadUrl.presignedUrl).searchParams.get('X-Amz-SignedHeaders') ?? '';
        assert.equal(signedHeaders, 'host');
        assert.equal(uploadUrl.mimetype, 'image/png');
    });
});
