import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import * as mime from 'mime-types';
import { ConfigsService } from '../../configs';
import type { AwsConfig } from '../../configs/configuration';

type AwsS3UploadFile = {
    key: string;
    contentType?: string;
};

type AwsS3UploadUrl = {
    result: boolean;
    msg: string;
    publicUrl: string;
    mimetype: string;
    presignedUrl: string;
};

@Injectable()
export class AwsS3Service {
    private expires = 300;

    constructor(private readonly configsService: ConfigsService) {}

    private getAwsConfig(): AwsConfig {
        const aws = this.configsService.aws;
        if (!aws) {
            throw new Error(
                'AWS 설정이 필요합니다. ECHOCAST_AWS_BUCKET_NAME, ECHOCAST_AWS_REGION, ECHOCAST_AWS_URL을 설정하세요.'
            );
        }

        return aws;
    }

    private createS3Client(aws: AwsConfig): S3Client {
        if (this.configsService.isLocal()) {
            if (!aws.accessKeyId || !aws.secretAccessKey) {
                throw new Error(
                    '로컬 S3 업로드에는 ECHOCAST_AWS_ACCESS_KEY_ID와 ECHOCAST_AWS_SECRET_ACCESS_KEY 설정이 필요합니다.'
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

    async getUploadUrls({ keys, files }: { keys?: string[]; files?: AwsS3UploadFile[] }): Promise<AwsS3UploadUrl[]> {
        const aws = this.getAwsConfig();
        const s3Client = this.createS3Client(aws);
        const uploadFiles: AwsS3UploadFile[] = files ?? (keys ?? []).map((key) => ({ key }));
        const results = await Promise.all(
            uploadFiles.map(async (file) => {
                const signedContentType = file.contentType?.trim();
                const contentType = signedContentType || mime.lookup(file.key) || 'application/octet-stream';
                const command = new PutObjectCommand({
                    Bucket: aws.bucketName,
                    Key: file.key,
                    ...(signedContentType ? { ContentType: contentType } : {}),
                });
                const signedUrl = await getSignedUrl(s3Client, command, {
                    expiresIn: this.expires,
                    ...(signedContentType ? { signableHeaders: new Set(['content-type']) } : {}),
                });
                const fileUrl = `${aws.awsUrl}/${file.key}`;
                return {
                    result: true,
                    msg: '주소 생성 성공',
                    publicUrl: fileUrl,
                    mimetype: contentType,
                    presignedUrl: signedUrl,
                };
            })
        );
        return results;
    }
}
