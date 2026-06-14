import { Injectable } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { AwsS3Service } from '../../../libs/aws';

type FileUploadUrlRequest = {
    key: string;
    contentType?: string;
};

@Injectable()
export class FileService extends DddService {
    constructor(private readonly awsS3Service: AwsS3Service) {
        super();
    }

    async getUploadUrls({ keys, files }: { keys?: string[]; files?: FileUploadUrlRequest[] }) {
        const uploadUrls = await this.awsS3Service.getUploadUrls(files ? { files } : { keys: keys ?? [] });

        return uploadUrls.map((uploadUrl: { publicUrl: string; mimetype: string; presignedUrl: string }) => ({
            publicUrl: uploadUrl.publicUrl,
            mimetype: uploadUrl.mimetype,
            presignedUrl: uploadUrl.presignedUrl,
        }));
    }
}
