import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import * as mime from 'mime-types';
import { ConfigsService } from '../../configs';
import type { AwsConfig } from '../../configs/configuration';

@Injectable()
export class AwsS3Service {
    private expires = 300;

    constructor(private readonly configsService: ConfigsService) {}

    private getAwsConfig(): AwsConfig {
        const aws = this.configsService.aws;
        if (!aws) {
            throw new Error(
                'AWS 설정이 필요합니다. TEST_PLAYER_AWS_BUCKET_NAME, TEST_PLAYER_AWS_REGION, TEST_PLAYER_AWS_URL을 설정하세요.'
            );
        }

        return aws;
    }

    private createS3Client(aws: AwsConfig): S3Client {
        if (this.configsService.isLocal()) {
            if (!aws.accessKeyId || !aws.secretAccessKey) {
                throw new Error(
                    '로컬 S3 업로드에는 TEST_PLAYER_AWS_ACCESS_KEY_ID와 TEST_PLAYER_AWS_SECRET_ACCESS_KEY 설정이 필요합니다.'
                );
            }

            return new S3Client({
                region: aws.region,
                credentials: {
                    accessKeyId: aws.accessKeyId,
                    secretAccessKey: aws.secretAccessKey,
                },
            });
        }

        return new S3Client({
            region: aws.region,
        });
    }

    async getUploadUrls({ keys }: { keys: string[] }): Promise<any> {
        const aws = this.getAwsConfig();
        const s3Client = this.createS3Client(aws);
        const results = await Promise.all(
            keys.map(async (key) => {
                const command = new PutObjectCommand({
                    Bucket: aws.bucketName,
                    Key: key,
                });
                const signedUrl = await getSignedUrl(s3Client, command, {
                    expiresIn: this.expires,
                });
                const fileUrl = `${aws.awsUrl}/${key}`;
                return {
                    result: true,
                    msg: '주소 생성 성공',
                    publicUrl: fileUrl,
                    mimetype: mime.lookup(key) || 'application/octet-stream',
                    presignedUrl: signedUrl,
                };
            })
        );
        return results;
    }
}
