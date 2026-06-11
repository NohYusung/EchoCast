import { Module } from '@nestjs/common';
import { AwsS3Module } from '../../libs/aws';
import { FileService } from './applications/file.service';
import { FileController } from './controllers/file.controller';

@Module({
    imports: [AwsS3Module],
    controllers: [FileController],
    providers: [FileService],
    exports: [FileService],
})
export class FileModule {}
