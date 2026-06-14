export type FileUploadUrlRequestDto = {
    key: string;
    contentType?: string;
};

export class FileUploadUrlsDto {
    keys?: string[];
    files?: FileUploadUrlRequestDto[];
}
