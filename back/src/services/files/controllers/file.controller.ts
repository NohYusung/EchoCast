import { Body, Controller, Dependencies, Post } from '@nestjs/common';
import { FileService } from '../applications/file.service';
import { FileUploadUrlsDto } from './dto';

@Dependencies(FileService)
@Controller()
export class FileController {
    constructor(private readonly fileService: FileService) {}

    /**
     * 파일 업로드 URL 생성
     */
    @Post('/files/uploadUrls')
    async getUploadUrls(@Body() body: FileUploadUrlsDto) {
        // 1. Destructure body, params, query
        const { files, keys } = body;

        // 2. Get context

        // 3. Get result
        const data = await this.fileService.getUploadUrls(files ? { files } : { keys });

        // 4. Send response
        return { data };
    }
}
